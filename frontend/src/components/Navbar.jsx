import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Navbar() {
  const [dark, setDark] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    document.body.classList.toggle('dark', dark)
  }, [dark])

  function logout() {
    localStorage.removeItem('token')
    nav('/')
  }

  return (
    <div className="d-flex justify-content-between mb-3">
      <strong>Painel</strong>

      <div>
        <button
          className="btn btn-secondary me-2"
          onClick={() => setDark(!dark)}
        >
          🌙
        </button>

        <button className="btn btn-danger" onClick={logout}>
          Sair
        </button>
      </div>
    </div>
  )
}