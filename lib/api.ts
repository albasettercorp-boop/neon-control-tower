/**
 * Backend API Client для интеграции с Python backend
 */

import { supabase } from './supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export class BackendAPI {
  /**
   * Загрузка CSV файла
   */
  static async uploadCSV(file: File): Promise<{
    success: boolean
    inserted: number
    total: number
    errors: string[]
  }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${BACKEND_URL}/api/parse-csv`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    return response.json()
  }

  /**
   * Квалификация лида
   */
  static async qualifyLead(leadId: string) {
    const response = await fetch(`${BACKEND_URL}/api/qualify/${leadId}`, {
      method: 'POST',
    })
    return response.json()
  }

  /**
   * Утверждение встречи
   */
  static async approveBooking(bookingId: string, confirmedTime: string) {
    const response = await fetch(`${BACKEND_URL}/api/approve-booking/${bookingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_time: confirmedTime }),
    })
    return response.json()
  }
}

/**
 * Supabase Helper Functions
 */
export class SupabaseHelper {
  /**
   * Получить лидов по статусу
   */
  static async getLeadsByStatus(status: string) {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('funnel_stage', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Получить заявки на бронирование
   */
  static async getBookingRequests(status = 'pending_approval') {
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*, seller:sellers(*)')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}
