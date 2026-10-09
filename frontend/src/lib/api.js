import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  withXSRFToken: true,
  timeout: 90_000,
  headers: { Accept: 'application/json' },
})

export async function writeApi(method, url, data) {
  await api.get('/sanctum/csrf-cookie', { baseURL: '/' })
  const response = await api.request({ method, url, data })
  return response.data?.data
}

export function errorMessage(error) {
  return error?.response?.data?.message ||
    'We could not reach DormFinder. The service may be starting up. Please try again.'
}

export function fieldErrors(error) {
  return error?.response?.data?.errors || {}
}

