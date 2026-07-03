import { Module } from '@nestjs/common';
import { SalesforceService } from './salesforce.service';
import { SalesforceController } from './salesforce.controller';

@Module({
  controllers: [SalesforceController],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {}
