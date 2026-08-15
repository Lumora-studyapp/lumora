import './emoji-font.css'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { getStudyWeek, getStudyWeekKey } from './studyWeek.js'

function LumoraRoot() {
  const [weekRolloverToken, setWeekRolloverToken] = useState(() => getStudyWeekKey())

  useEffect(() => {
    let timeoutId
    const refreshWeek = () => {
      const nextWeek = getStudyWeekKey()
      setWeekRolloverToken(currentWeek => currentWeek === nextWeek ? currentWeek : nextWeek)
    }
    const scheduleRollover = () => {
      refreshWeek()
      window.clearTimeout(timeoutId)
      const delay = Math.max(50, getStudyWeek().endExclusive.getTime() - Date.now() + 25)
      timeoutId = window.setTimeout(scheduleRollover, delay)
    }
    const onResume = () => {
      if (!document.hidden) scheduleRollover()
    }

    scheduleRollover()
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('focus', scheduleRollover)
    window.addEventListener('pageshow', scheduleRollover)

    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('focus', scheduleRollover)
      window.removeEventListener('pageshow', scheduleRollover)
    }
  }, [])

  return <App weekRolloverToken={weekRolloverToken} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LumoraRoot />
  </React.StrictMode>,
)
