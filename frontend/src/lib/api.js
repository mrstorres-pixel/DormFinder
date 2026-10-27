import axios from 'axios'
import { presentListingData } from './listingPresentation'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  withXSRFToken: true,
  timeout: 90_000,
  headers: { Accept: 'application/json' },
})

api.interceptors.response.use(response => {
  response.data = presentListingData(response.data)
  return response
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

