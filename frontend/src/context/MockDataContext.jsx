import { createContext, useContext, useState } from 'react'
const Context = createContext(null)
const KEY = 'novelhub.mock-data.v1'
const initial = {
  agreements: {
    'user-author': {
      authorShare: 80,
      platformShare: 20,
      status: 'active',
      effectiveFrom: '2026-09-29',
      updatedBy: 'System Admin',
    },
  },
  simulation: 'normal',
}
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || initial
  } catch {
    return initial
  }
}
export function MockDataProvider({ children }) {
  const [data, setData] = useState(load)
  const update = next => {
    setData(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }
  const saveAgreement = (id, authorShare) => {
    const value = Number(authorShare)
    if (!Number.isFinite(value) || value < 0 || value > 100)
      throw new Error('Tỷ lệ của tác giả phải nằm trong khoảng từ 0 đến 100.')
    update({
      ...data,
      agreements: {
        ...data.agreements,
        [id]: {
          authorShare: value,
          platformShare: 100 - value,
          status: 'active',
          effectiveFrom: new Date().toISOString().slice(0, 10),
          updatedBy: 'Marcus Vance',
        },
      },
    })
  }
  const value = {
    data,
    saveAgreement,
    setSimulation: simulation => update({ ...data, simulation }),
    reset: () => update(initial),
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useMockData = () => useContext(Context)
