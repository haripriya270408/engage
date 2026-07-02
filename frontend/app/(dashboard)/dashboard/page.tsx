'use client';

export default function DashboardPage() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <img src="/RelantoLogo.svg" alt="Relanto" className="h-6" />
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              Sales Command Center
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            </h1>
          </div>
          <p className="text-gray-500 mt-1">
            0 high-priority deals need attention today — 0 at risk of slipping
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Logout
          </button>
          <button className="bg-[#1e293b] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800">
            <span className="text-lg leading-none">+</span> Create Task
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-gray-200">
        <button className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </button>
        <div className="flex-1 flex items-center gap-2 border-l border-gray-200 pl-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input 
            type="text" 
            placeholder="Search tasks, contacts, companies..." 
            className="w-full bg-transparent border-0 px-2 py-1.5 outline-none text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        {/* Left Column - Tasks */}
        <div className="space-y-6">
          
          {/* Tabs */}
          <div className="flex justify-between items-center border-b border-gray-200">
            <div className="flex gap-6 text-sm font-medium">
              <button className="text-blue-600 border-b-2 border-blue-600 pb-3 flex items-center gap-2">
                Today <span className="bg-blue-50 text-blue-600 py-0.5 px-2 rounded-full text-xs">0</span>
              </button>
              <button className="text-gray-500 hover:text-gray-700 pb-3 flex items-center gap-2">
                In Progress <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs">0</span>
              </button>
              <button className="text-gray-500 hover:text-gray-700 pb-3">
                Upcoming
              </button>
              <button className="text-gray-500 hover:text-gray-700 pb-3 flex items-center gap-2">
                Completed <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs">0</span>
              </button>
              <button className="text-gray-500 hover:text-gray-700 pb-3">
                Snoozed
              </button>
            </div>
            <div className="flex gap-4 text-xs font-medium pb-3">
              <span className="text-red-500 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                0 at risk
              </span>
              <span className="text-gray-400 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                0 due today
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                Today&apos;s Progress
              </h3>
              <span className="text-sm font-medium text-gray-800">0/0</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
              <div className="bg-[#1e293b] h-2.5 rounded-full w-0"></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 high-priority tasks remaining</span>
              <span>0% complete</span>
            </div>
          </div>

          {/* High Priority List */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-gray-800">High Priority</h3>
              <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs font-medium">0</span>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h4 className="text-gray-900 font-medium mb-1">No tasks for today</h4>
              <p className="text-gray-500 text-sm">You&apos;re all caught up! Enjoy your day.</p>
            </div>
          </div>

        </div>

        {/* Right Column - Recent Activity */}
        <div>
          <div className="flex gap-4 text-xs font-medium border-b border-gray-200 pb-3 mb-6">
            <button className="text-gray-900 border-b-2 border-gray-900 pb-3 -mb-[14px]">All</button>
            <button className="text-gray-500 hover:text-gray-700 flex items-center gap-1">✉️ Email</button>
            <button className="text-gray-500 hover:text-gray-700 flex items-center gap-1">📞 Call</button>
            <button className="text-gray-500 hover:text-gray-700 flex items-center gap-1">in LinkedIn</button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-800">Recent Activity</h3>
            <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs font-medium">0</span>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center h-48 flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  );
}
