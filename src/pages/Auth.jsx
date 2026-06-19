import { useState } from 'react'
import { supabase } from '../supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name } },
        })
        console.log('signUp result:', { data, error })
        if (error) setMessage(String(error.message || JSON.stringify(error)))
        else setMessage('確認メールを送りました。メールを確認してください。')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        console.log('signIn result:', { data, error })
        if (error) setMessage(String(error.message || 'メールアドレスかパスワードが違います'))
      }
    } catch (e) {
      console.error('Auth exception:', e)
      setMessage('通信エラーが発生しました: ' + String(e.message))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-400 to-green-700 flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <div className="text-6xl mb-3">⚾</div>
        <h1 className="text-3xl font-bold text-white">ピッチング記録</h1>
        <p className="text-green-100 mt-1">チームで成長を共有しよう</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-5 text-center">
          {isSignUp ? '新規登録' : 'ログイン'}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="田中 太郎"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="6文字以上"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {message && (
            <p className="text-sm text-center text-red-500 bg-red-50 rounded-lg py-2 px-3">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '処理中...' : isSignUp ? '登録する' : 'ログイン'}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
          className="w-full mt-4 text-sm text-green-600 hover:text-green-700 font-medium"
        >
          {isSignUp ? 'すでにアカウントがある方はこちら' : 'アカウントをお持ちでない方はこちら'}
        </button>
      </div>
    </div>
  )
}
