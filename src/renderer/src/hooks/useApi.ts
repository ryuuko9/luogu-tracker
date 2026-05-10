import { useState, useCallback } from 'react'
import type { Training, Problem, UserInfo } from '../types'

export function useApi() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

  const fetchTrainings = useCallback(async () => {
    const data = await window.api.getTrainings()
    setTrainings(data)
  }, [])

  const fetchProblems = useCallback(async (trainingId: number) => {
    const data = await window.api.getProblems(trainingId)
    setProblems(data)
  }, [])

  const importTraining = useCallback(async (input: string) => {
    setImporting(true)
    try {
      await window.api.importTraining(input)
      await fetchTrainings()
    } finally {
      setImporting(false)
    }
  }, [fetchTrainings])

  const deleteTraining = useCallback(async (id: number) => {
    await window.api.deleteTraining(id)
    setTrainings(prev => prev.filter(t => t.id !== id))
  }, [])

  const toggleProblem = useCallback(async (id: number) => {
    const newVal = await window.api.toggleProblem(id)
    setProblems(prev => prev.map(p => p.id === id ? { ...p, completed: newVal } : p))
    await fetchTrainings()
    return newVal
  }, [fetchTrainings])

  const updateNote = useCallback(async (id: number, note: string) => {
    await window.api.updateNote(id, note)
    setProblems(prev => prev.map(p => p.id === id ? { ...p, note } : p))
  }, [])

  const fetchLoginStatus = useCallback(async () => {
    const info = await window.api.getLoginStatus()
    setUserInfo(info)
  }, [])

  const handleLogin = useCallback(async () => {
    const info = await window.api.login()
    setUserInfo(info)
  }, [])

  const handleLogout = useCallback(async () => {
    await window.api.logout()
    setUserInfo(null)
  }, [])

  return {
    trainings, problems, loading, importing, userInfo,
    fetchTrainings, fetchProblems, importTraining,
    deleteTraining, toggleProblem, updateNote,
    fetchLoginStatus, handleLogin, handleLogout,
    setLoading
  }
}
