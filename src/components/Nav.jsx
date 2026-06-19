const tabs = [
  { id: 'home', label: 'ホーム', icon: '🏠' },
  { id: 'record', label: '記録', icon: '⚾' },
  { id: 'stats', label: '統計', icon: '📈' },
  { id: 'team', label: 'チーム', icon: '👥' },
]

export default function Nav({ page, setPage }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex shadow-lg">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setPage(tab.id)}
          className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
            page === tab.id ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          <span className="text-xl mb-0.5">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
