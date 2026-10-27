const version = 1
const roles = ['student', 'landlord', 'admin']
export const walkthroughHome = role => role === 'landlord' ? '/landlord' : role === 'admin' ? '/admin' : '/listings'
export const walkthroughKey = user => user && roles.includes(user.role) ? `dormfinder:walkthrough:v${version}:${user.id}:${user.role}` : null

export function readWalkthrough(owner, storage) {
  const empty = { owner, status: 'idle', index: 0, context: {}, trigger: null, run: 0 }
  if (!owner) return empty
  try {
    const value = JSON.parse((storage || window.sessionStorage).getItem(owner))
    if (!value || value.owner !== owner || !['active', 'paused', 'done'].includes(value.status) || !Number.isInteger(value.index) || value.index < 0 || value.index > 30 || Date.now() - value.updated > 43_200_000) return empty
    const context = {
      listingPath: /^\/listings\/\d+$/.test(value.context?.listingPath) ? value.context.listingPath : null,
      propertyPath: /^\/landlord\/properties\/\d+$/.test(value.context?.propertyPath) ? value.context.propertyPath : null,
      propertyStatus: ['draft', 'rejected', 'approved'].includes(value.context?.propertyStatus) ? value.context.propertyStatus : null,
    }
    if (value.index >= walkthroughSteps(owner.split(':').at(-1), context).length) return empty
    return { ...empty, ...value, context }
  } catch { return empty }
}

export function walkthroughSteps(role, context = {}) {
  const step = (key, title, body, path, selectors, extra = {}) => ({ key, title, body, path, selectors: Array.isArray(selectors) ? selectors : [selectors], ...extra })
  const shared = [
    step('messages', 'A conversation starts here.', role === 'landlord' ? 'Students can contact you from a published listing. Their questions appear here. Open a conversation to reply, and keep the discussion attached to the right room.' : 'Open a listing and choose Message owner to ask a private question. Your conversations and replies live here, together.', '/inquiries', '[data-tour="inbox"]'),
    step('viewings', 'Put a visit on your calendar.', role === 'landlord' ? 'Review students’ viewing requests, accept a time or suggest another, and keep confirmed visits on your calendar. A request still needs your response.' : 'Request a visit from a listing. Use this calendar to track the owner’s response and confirmed visits. Times use Philippine time; a viewing does not reserve a room.', '/viewings', '[data-tour="viewings"]'),
    step('notifications', 'A little nudge when things change.', 'Open the bell for new updates without leaving your page. An unread dot means there is something new. You can expand the notification window for more detail.', null, ['.notification-popover', '[data-tour="notifications"]'], { modal: true }),
  ]
  if (role === 'student') return [
    step('search', 'Start wherever feels like home.', 'Search a campus, neighborhood, street or dorm name in this one bar. Choose a campus suggestion when you want campus distances and walking routes.', '/listings', '[data-tour="search"]'),
    step('filters', 'Find a room that fits your day.', 'Open Filters to set a budget, room type, amenities or distance limit. Choose per person or per room before comparing rent. Your search words stay in place.', '/listings', '[data-tour="filters"]', { modal: true }),
    step('open-place', 'Take a closer look.', 'A listing’s image or title opens its full details. You can try one now, or choose Next and we will open an available place for this walkthrough.', '/listings', ['.listing-grid .property-card', '.discovery-results']),
    ...(context.listingPath ? [
      step('room', 'Choose the room you mean.', 'A property can offer different beds or whole rooms. Choose the option you want; the price, vacancy count and viewing request follow that choice.', context.listingPath, '[data-tour="room-choice"]'),
      step('costs', 'See more than the base rent.', 'Check monthly charges, deposit, advance rent and other stated fees. The pricing basis matters: a price per person is different from a price for the whole room.', context.listingPath, '.room-cost-overview'),
      step('save', 'Keep this possibility.', 'Tap the heart to save a place for later. Compare adds the selected room to your comparison tray, where you can compare up to three listings side by side.', context.listingPath, '[data-tour="listing-save"]'),
      step('walking', 'Picture your walk to class.', 'Show the map and search for your walking destination. Select your campus explicitly, then choose Walk to campus to see a route, distance and estimated minutes.', context.listingPath, '[data-tour="location"]'),
      step('contact', 'Ask a question. Arrange a visit.', 'Message owner opens a private question. Request a viewing lets you propose a visit. You decide whether to send either form; this walkthrough does not send anything for you.', context.listingPath, '[data-tour="listing-contact"]', { modal: true }),
    ] : []),
    step('saved', 'Make a small collection of possibilities.', 'Your hearts bring places here. Add private notes, organize collections and return to the room you chose. Removing a saved place keeps your messages and viewing requests.', '/saved', '[data-tour="saved-places"]'),
    ...shared,
  ]
  if (role === 'landlord') return [
    step('workspace', 'Your properties, in one place.', 'This is your workspace. Open a property to manage its photos, rooms, details and availability. Use Properties, Needs attention and Archived to find your work. Update availability on a property card to confirm all room counts together. Pause advertising for a temporary break, or archive a property you no longer manage.', '/landlord', '[data-tour="owner-workspace"]'),
    step('add-property', 'Make room for a new listing.', 'Add a property starts a private draft. It stays private while you prepare it and only appears in public search after review.', '/landlord', '[data-tour="add-property"]'),
    step('basics', 'Start with the essentials.', 'Give the property a recognizable name, choose its type and enter its city. You can use these fields after the walkthrough; Next will not create a property.', '/landlord/properties/new', '[data-tour="listing-basics"]', { interactive: false }),
    ...(context.propertyPath ? [
      step('photos', 'Let students see the space.', 'Upload clear photos of the actual property and describe each image. Choose a useful cover photo. At least one ready photo is needed before review.', context.propertyPath + '#photos', '#editor-photos', { interactive: false }),
      step('rooms', 'Keep each room option clear.', 'Describe separate beds or whole rooms, capacity, vacancies, rent, deposit and utility terms. Save and continue saves a valid option before advancing. Do not count the same inventory twice.', context.propertyPath + '#rooms', '#editor-rooms', { interactive: false }),
      step('location', 'Put the property in the right place.', 'Type a street address for suggestions, choose a result, then adjust the entrance pin. Moving the pin looks up the nearest mapped address. Check the editable street address and city before saving.', context.propertyPath + '#location', '#editor-location', { interactive: false }),
      step('review', 'See what students will see.', 'This checklist explains anything still missing. Review the saved details and confirm that room options describe separate inventory before submitting. This walkthrough never submits a listing.', context.propertyPath + '#preview', '[data-tour="review-readiness"]', { interactive: false }),
      step('availability', 'Taken? Update the actual vacancies.', context.propertyStatus === 'approved' ? 'Use Update availability for published rooms. Set available units to 0 when all beds or rooms in that option are taken, then confirm. This marks the option sold out and stops new viewing requests for it.' : 'Available units means beds or rooms ready to rent now. Set it to 0 when the option is taken. After publication, use Update availability to update vacancies without changing the room’s price or terms.', context.propertyPath + '#rooms', ['.owner-room-availability-action', '#editor-rooms'], { interactive: false }),
    ] : [step('private-draft', 'Build it at your own pace.', 'When you are ready, Start listing creates your private draft. The editor then walks through Photos, Rooms & costs, Location & details, and Preview & review. We will not create a sample property during this tour.', '/landlord/properties/new', '[data-tour="start-listing"]', { interactive: false })]),
    ...shared,
  ]
  return [
    step('reviews', 'A clear place to start reviewing.', 'New submissions appear in this queue. Search, filter and sort the results, then open a listing to check its saved content and review checklist.', '/admin', '.admin-review-workflow'),
    step('reports', 'Follow up on student concerns.', 'Filter reports by their status or category. Open a report to read the concern and record a resolution with context.', '/admin/reports', '.admin-workspace'),
    step('all-listings', 'Find the property behind the question.', 'Search titles or owner names, filter listing status and type, and use pagination for larger directories. Open a listing to inspect it before taking action.', '/admin/listings', '.admin-table-wrap, .admin-empty'),
    step('accounts', 'Keep account actions deliberate.', 'Search students and owners by name or email. Moderation actions require a reason and confirmation. This walkthrough does not change any account.', '/admin/users', '.admin-workspace'),
    step('campuses', 'Keep campus destinations accurate.', 'Add specific campus branches with a verified pedestrian entrance and a source. Review missing-campus suggestions here. Deactivation preserves existing references and history.', '/admin/campuses', '.admin-workspace'),
    step('audit', 'Leave a readable history.', 'Review recorded moderation actions with the actor, listing and reason. Filter by action or date to understand what changed. Private inquiry messages remain private.', '/admin/audit', '.admin-workspace'),
    step('notifications', 'Keep up with new review work.', 'The bell brings new submissions and report updates into one window. The dot indicates unread notifications.', null, ['.notification-popover', '[data-tour="notifications"]'], { modal: true }),
  ]
}

export function spotlightBounds(rect, viewport, padding = 8) {
  const left = Math.max(6, Math.min(viewport.width - 6, rect.left - padding))
  const top = Math.max(6, Math.min(viewport.height - 6, rect.top - padding))
  const right = Math.max(left, Math.min(viewport.width - 6, rect.right + padding))
  const bottom = Math.max(top, Math.min(viewport.height - 6, rect.bottom + padding))
  return { left, top, width: right - left, height: bottom - top, right, bottom }
}

export function coachPosition(target, viewport, size) {
  const margin = 16, gap = 18
  const width = Math.min(368, viewport.width - margin * 2)
  const height = Math.min(size.height, viewport.height - margin * 2)
  const centered = Math.max(margin, Math.min(viewport.width - width - margin, target ? target.left + target.width / 2 - width / 2 : (viewport.width - width) / 2))
  if (!target) return { left: centered, top: Math.max(margin, (viewport.height - height) / 2), width, placement: 'center' }
  if (target.right + gap + width + margin <= viewport.width) return { left: target.right + gap, top: Math.max(margin, Math.min(target.top, viewport.height - height - margin)), width, placement: 'right' }
  if (target.left - gap - width >= margin) return { left: target.left - gap - width, top: Math.max(margin, Math.min(target.top, viewport.height - height - margin)), width, placement: 'left' }
  if (target.bottom + gap + height + margin <= viewport.height) return { left: centered, top: target.bottom + gap, width, placement: 'below' }
  if (target.top - gap - height >= margin) return { left: centered, top: target.top - gap - height, width, placement: 'above' }
  return { left: Math.max(margin, viewport.width - width - margin), top: Math.max(margin, viewport.height - height - (viewport.width < 768 ? 88 : margin)), width, placement: 'corner' }
}
