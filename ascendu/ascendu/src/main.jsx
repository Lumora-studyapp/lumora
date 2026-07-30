import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const getLocalWeekStart = (value = new Date()) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - date.getDay())
  return date.getTime()
}

function LumoraRoot() {
  const [weekRolloverToken, setWeekRolloverToken] = useState(() => getLocalWeekStart())

  useEffect(() => {
    const refreshWeek = () => {
      const nextWeek = getLocalWeekStart()
      setWeekRolloverToken(currentWeek => currentWeek === nextWeek ? currentWeek : nextWeek)
    }

    refreshWeek()
    const intervalId = window.setInterval(refreshWeek, 60 * 1000)
    document.addEventListener('visibilitychange', refreshWeek)
    window.addEventListener('focus', refreshWeek)
    window.addEventListener('pageshow', refreshWeek)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshWeek)
      window.removeEventListener('focus', refreshWeek)
      window.removeEventListener('pageshow', refreshWeek)
    }
  }, [])

  return <App weekRolloverToken={weekRolloverToken} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LumoraRoot />
  </React.StrictMode>,
)
