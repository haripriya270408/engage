terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  region = var.aws_region
}

# ──────────────────────────────────────────
#  VPC & Networking
# ──────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags = { Name = "${var.project_name}-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true
  tags = { Name = "${var.project_name}-public-b" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.project_name}-rt-public" }
}

resource "aws_route_table_association" "a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

# ──────────────────────────────────────────
#  Security Groups
# ──────────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Allow HTTP/HTTPS from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project_name}-alb-sg" }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-ecs-sg"
  description = "Allow traffic from ALB only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project_name}-ecs-sg" }
}

# ──────────────────────────────────────────
#  ECR Repositories
# ──────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = { Name = "${var.project_name}-backend" }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = { Name = "${var.project_name}-frontend" }
}

# ──────────────────────────────────────────
#  Application Load Balancer
# ──────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
  tags               = { Name = "${var.project_name}-alb" }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-backend-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }
  tags = { Name = "${var.project_name}-backend-tg" }
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-frontend-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }
  tags = { Name = "${var.project_name}-frontend-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/salesforce/*"]
    }
  }
}

# ──────────────────────────────────────────
#  ECS Cluster
# ──────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
  tags = { Name = "${var.project_name}-cluster" }
}

# ──────────────────────────────────────────
#  IAM Roles for ECS
# ──────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-ecs-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets_access" {
  name = "${var.project_name}-secrets-access"
  role = aws_iam_role.ecs_task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project_name}-secrets*"
    }]
  })
}

# ──────────────────────────────────────────
#  CloudWatch Log Groups
# ──────────────────────────────────────────
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}/backend"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.project_name}/frontend"
  retention_in_days = 7
}

# ──────────────────────────────────────────
#  ECS Task Definitions
# ──────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = [
      { name = "PORT", value = "3000" },
      { name = "NODE_ENV", value = "production" },
      { name = "FRONTEND_URL", value = "http://${aws_lb.main.dns_name}" },
      { name = "SALESFORCE_REDIRECT_URI", value = "http://${aws_lb.main.dns_name}/salesforce/callback" },
      { name = "OUTLOOK_REDIRECT_URI", value = "http://${aws_lb.main.dns_name}/email" }
    ]
    secrets = [
      { name = "SUPABASE_URL", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SUPABASE_URL::" },
      { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SUPABASE_SERVICE_ROLE_KEY::" },
      { name = "JWT_SECRET", valueFrom = "${aws_secretsmanager_secret.engage.arn}:JWT_SECRET::" },
      { name = "GROQ_API_KEY", valueFrom = "${aws_secretsmanager_secret.engage.arn}:GROQ_API_KEY::" },
      { name = "OUTLOOK_CLIENT_ID", valueFrom = "${aws_secretsmanager_secret.engage.arn}:OUTLOOK_CLIENT_ID::" },
      { name = "OUTLOOK_CLIENT_SECRET", valueFrom = "${aws_secretsmanager_secret.engage.arn}:OUTLOOK_CLIENT_SECRET::" },
      { name = "OUTLOOK_TENANT_ID", valueFrom = "${aws_secretsmanager_secret.engage.arn}:OUTLOOK_TENANT_ID::" },
      { name = "SALESFORCE_CLIENT_ID", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SALESFORCE_CLIENT_ID::" },
      { name = "SALESFORCE_CLIENT_SECRET", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SALESFORCE_CLIENT_SECRET::" },
      { name = "SALESFORCE_USERNAME", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SALESFORCE_USERNAME::" },
      { name = "SALESFORCE_PASSWORD", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SALESFORCE_PASSWORD::" },
      { name = "SALESFORCE_SECURITY_TOKEN", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SALESFORCE_SECURITY_TOKEN::" },
      { name = "SALESFORCE_LOGIN_URL", valueFrom = "${aws_secretsmanager_secret.engage.arn}:SALESFORCE_LOGIN_URL::" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "frontend"
    image     = "${aws_ecr_repository.frontend.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 3001, protocol = "tcp" }]
    environment = [
      { name = "NEXT_PUBLIC_API_URL", value = "http://${aws_lb.main.dns_name}/api" },
      { name = "NEXT_PUBLIC_AZURE_CLIENT_ID", value = var.outlook_client_id },
      { name = "NEXT_PUBLIC_AZURE_TENANT_ID", value = var.outlook_tenant_id }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# ──────────────────────────────────────────
#  ECS Services
# ──────────────────────────────────────────
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener_rule.api]
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3001
  }

  depends_on = [aws_lb_listener.http]
}

# ──────────────────────────────────────────
#  Secrets Manager
# ──────────────────────────────────────────
resource "aws_secretsmanager_secret" "engage" {
  name        = "${var.project_name}-secrets"
  description = "All environment secrets for the Engage platform"
}

resource "aws_secretsmanager_secret_version" "engage" {
  secret_id = aws_secretsmanager_secret.engage.id
  secret_string = jsonencode({
    SUPABASE_URL               = var.supabase_url
    SUPABASE_SERVICE_ROLE_KEY  = var.supabase_service_role_key
    JWT_SECRET                 = var.jwt_secret
    GROQ_API_KEY               = var.groq_api_key
    OUTLOOK_CLIENT_ID          = var.outlook_client_id
    OUTLOOK_CLIENT_SECRET      = var.outlook_client_secret
    OUTLOOK_TENANT_ID          = var.outlook_tenant_id
    SALESFORCE_CLIENT_ID       = var.salesforce_client_id
    SALESFORCE_CLIENT_SECRET   = var.salesforce_client_secret
    SALESFORCE_USERNAME        = var.salesforce_username
    SALESFORCE_PASSWORD        = var.salesforce_password
    SALESFORCE_SECURITY_TOKEN  = var.salesforce_security_token
    SALESFORCE_LOGIN_URL       = var.salesforce_login_url
  })
}
