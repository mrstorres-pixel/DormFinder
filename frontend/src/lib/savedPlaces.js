export function savedDetails(row, collection) {
  return (row.contexts || []).find(item => String(item.collection_id) === String(collection || row.default_context || '')) || row
}

export function savedDraft(row, context = '') {
  const details = context ? row.contexts.find(item => String(item.collection_id) === String(context)) : row.saved_details || { room_option_id: row.default_context ? null : row.room_option_id, note: row.default_context ? '' : row.note }
  return { room: String(details?.room_option_id || ''), note: details?.note || '', collections: (row.contexts || []).map(item => item.collection_id).sort((a, b) => a - b) }
}

export async function refreshSaved(client) {
  await Promise.all(['saved-places', 'saved-place', 'favorite-ids', 'favorites', 'shortlists', 'shortlist', 'dashboard'].map(key => client.invalidateQueries({ queryKey: [key] })))
}
