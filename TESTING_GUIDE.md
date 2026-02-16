
# Slovenia Events App - Testing Guide

## 🔐 Authentication Testing

### Test Accounts

Since this is a fresh deployment, you'll need to create test accounts:

#### Regular User Account
1. Open the app
2. Click "Sign Up"
3. Enter:
   - Email: `user@test.com`
   - Password: `Test123!`
   - Name: `Test User`
4. Complete onboarding:
   - Username: `testuser`
   - Region: Ljubljana
   - City: Ljubljana
   - Enable location sharing

#### Organizer Account
1. Sign up with:
   - Email: `organizer@test.com`
   - Password: `Test123!`
   - Name: `Test Organizer`
2. Complete onboarding:
   - Username: `testorganizer`
   - Region: Ljubljana
   - City: Ljubljana

**Note:** To make this account an organizer, an admin needs to update the role via the backend or admin panel.

#### Admin Account
1. Sign up with:
   - Email: `admin@test.com`
   - Password: `Admin123!`
   - Name: `Admin User`
2. Complete onboarding:
   - Username: `admin`

**Note:** To make this account an admin, you need to update the role directly in the database.

### OAuth Testing

#### Google OAuth
1. Click "Continue with Google"
2. On web: A popup will open for Google sign-in
3. On mobile: Will redirect to Google OAuth flow
4. After successful auth, you'll be redirected back to the app

#### Apple OAuth (iOS only)
1. Click "Continue with Apple"
2. Follow Apple's sign-in flow
3. After successful auth, you'll be redirected back to the app

---

## 📱 Feature Testing Checklist

### Anonymous User Features
- [ ] Browse upcoming events (sorted by distance)
- [ ] View event details (read-only)
- [ ] See event comments (read-only)
- [ ] See event images (read-only)
- [ ] See total going count
- [ ] See average rating
- [ ] Filter events by genre
- [ ] Filter events by region
- [ ] Search events by title
- [ ] Cannot see attendee identities
- [ ] See "Sign in" prompts on restricted actions

### Authenticated User Features

#### Profile Management
- [ ] View own profile
- [ ] Edit username (lowercase, a-z0-9_-, min 3 chars)
- [ ] Update region and city
- [ ] Toggle location visibility
- [ ] Add Instagram username
- [ ] Add Snapchat username
- [ ] Sign out

#### Event Discovery
- [ ] Browse events with location permission
- [ ] Browse events by manual region selection
- [ ] Filter by genre
- [ ] Filter by region
- [ ] Search events
- [ ] View event details

#### Event Interactions
- [ ] Mark event as "Going"
- [ ] Remove "Going" status
- [ ] View attendee list (only if going)
- [ ] Follow organizer
- [ ] Unfollow organizer
- [ ] Add comment (only if going, within interaction window)
- [ ] Delete own comment
- [ ] Rate event (1.0-5.0, only if going, within interaction window)
- [ ] Update own rating
- [ ] View event images
- [ ] Upload images (max 5 per user per event, only if going, within interaction window)
- [ ] Delete own images

#### My Events
- [ ] View upcoming events (marked as going)
- [ ] View past events
- [ ] See "Can Rate" badge for events within interaction window
- [ ] Navigate to event details from list

### Organizer Features

#### Event Management
- [ ] View all own events (drafts + published)
- [ ] Create new event
  - [ ] Set title, description, lineup
  - [ ] Add poster URL
  - [ ] Select region and city
  - [ ] Enter address
  - [ ] Set start and end date/time
  - [ ] Select genre
  - [ ] Set price type (free/paid)
  - [ ] Add ticket URL (if paid)
  - [ ] Set status (draft/published/cancelled)
- [ ] Edit own event
- [ ] Delete own event
- [ ] View event statistics:
  - [ ] Going count
  - [ ] Comments count
  - [ ] Images count
  - [ ] Ratings count
  - [ ] Average rating

#### Restrictions
- [ ] Cannot mark own events as "Going"
- [ ] Organizer profile has no attended counter
- [ ] Organizer profile has no social usernames

### Admin Features (Not Yet Implemented)
- [ ] Set user roles (user/organizer/admin)
- [ ] Hard delete any event
- [ ] Hard delete any comment
- [ ] Hard delete any image
- [ ] Hard delete any rating
- [ ] Ban users

---

## 🧪 Test Scenarios

### Scenario 1: New User Onboarding
1. Open app (not signed in)
2. Browse events anonymously
3. Try to mark event as going → See sign-in prompt
4. Click "Sign In"
5. Switch to "Sign Up"
6. Create account
7. Complete onboarding profile
8. Redirected to home screen
9. Now can mark events as going

### Scenario 2: Event Discovery Flow
1. Sign in as regular user
2. Grant location permission
3. See events sorted by distance
4. Apply genre filter (e.g., "electronic")
5. Apply region filter (e.g., "Ljubljana")
6. Search for specific event
7. Click on event to view details
8. Mark as "Going"
9. View attendee list
10. Follow organizer
11. Add comment
12. Rate event (if within interaction window)

### Scenario 3: Organizer Event Creation
1. Sign in as organizer
2. Navigate to "My Events" (organizer tab)
3. Click "Create Event"
4. Fill in all required fields:
   - Title: "Test Electronic Party"
   - Description: "Amazing night of electronic music"
   - Lineup: "DJ Test, DJ Example"
   - Region: Ljubljana
   - City: Ljubljana
   - Address: "Metelkova 6, Ljubljana"
   - Start: Tomorrow at 22:00
   - End: Tomorrow at 04:00
   - Genre: electronic
   - Price: Free
   - Status: Published
5. Click "Create Event"
6. Event appears in organizer's event list
7. Event appears in public feed
8. View event statistics

### Scenario 4: Event Interaction Window
1. Sign in as regular user
2. Mark event as "Going"
3. Wait for event to end
4. Within 7 days after event end:
   - [ ] Can add comments
   - [ ] Can upload images (max 5)
   - [ ] Can rate event
5. After 7 days:
   - [ ] Cannot add comments
   - [ ] Cannot upload images
   - [ ] Cannot rate event
   - [ ] Can only view existing content

### Scenario 5: Social Features
1. Sign in as user A
2. Mark event as "Going"
3. Sign in as user B
4. Mark same event as "Going"
5. User A views attendee list → Sees user B
6. User B views attendee list → Sees user A
7. Sign out
8. Browse event anonymously → Cannot see attendee identities

---

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Image Upload**: Not yet implemented (requires multipart form data handling)
2. **Admin Panel**: Not yet implemented
3. **Push Notifications**: Not yet implemented (OneSignal integration pending)
4. **Real-time Updates**: Events list doesn't auto-refresh (manual pull-to-refresh required)
5. **Geolocation**: Uses simple distance calculation (not road distance)

### Expected Behaviors
1. **Anonymous Users**: Cannot see attendee identities or interact with events
2. **Interaction Window**: Comments/ratings/images only allowed from event end to +7 days
3. **Max Images**: Users can upload max 5 images per event
4. **Username Format**: Lowercase only, a-z0-9_-, min 3 characters
5. **Rating Format**: 1.0-5.0 with 1 decimal place

---

## 🔍 API Endpoints Being Used

### Public Endpoints
- `GET /api/events` - List events with filters
- `GET /api/events/:id` - Event details
- `GET /api/events/:id/comments` - Event comments
- `GET /api/events/:id/images` - Event images
- `GET /api/organizers/:id` - Organizer profile
- `GET /api/organizers` - List organizers

### Authenticated Endpoints
- `GET /api/profile` - Get own profile
- `PUT /api/profile` - Update own profile
- `GET /api/profile/going` - Get user's going events
- `POST /api/events/:id/going` - Mark as going
- `DELETE /api/events/:id/going` - Remove going
- `GET /api/events/:id/attendees` - Get attendee list
- `POST /api/organizers/:id/follow` - Follow organizer
- `DELETE /api/organizers/:id/follow` - Unfollow organizer
- `POST /api/events/:id/comments` - Add comment
- `DELETE /api/comments/:id` - Delete own comment
- `POST /api/events/:id/ratings` - Rate event
- `PUT /api/ratings/:id` - Update rating
- `POST /api/events/:id/images` - Upload image
- `DELETE /api/images/:id` - Delete own image

### Organizer Endpoints
- `GET /api/organizer/events` - Get own events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Admin Endpoints (Not Yet Integrated)
- `PUT /api/users/:id/role` - Set user role
- `DELETE /api/events/:id/admin` - Hard delete event
- `DELETE /api/comments/:id/admin` - Hard delete comment
- `DELETE /api/images/:id/admin` - Hard delete image
- `DELETE /api/ratings/:id/admin` - Hard delete rating
- `POST /api/users/:id/ban` - Ban user

---

## 📊 Testing Metrics

### Performance
- [ ] Events list loads in < 2 seconds
- [ ] Event detail loads in < 1 second
- [ ] Profile updates save in < 1 second
- [ ] Comments post in < 1 second
- [ ] Ratings submit in < 1 second

### UX
- [ ] Loading indicators show during API calls
- [ ] Error messages are clear and actionable
- [ ] Success messages confirm actions
- [ ] Pull-to-refresh works on all lists
- [ ] Navigation is intuitive
- [ ] Forms validate input before submission

### Security
- [ ] Anonymous users cannot access protected endpoints
- [ ] Users cannot modify other users' data
- [ ] Organizers can only edit own events
- [ ] Username validation prevents invalid characters
- [ ] Rating validation enforces 1.0-5.0 range
- [ ] Comment length limited to 300 characters
- [ ] Description length limited to 4000 characters

---

## 🚀 Next Steps

### High Priority
1. Implement image upload functionality
2. Add admin panel for user management
3. Integrate OneSignal for push notifications
4. Add event edit screen for organizers
5. Implement proper error boundaries

### Medium Priority
1. Add event search with autocomplete
2. Implement event recommendations
3. Add user profiles (public view)
4. Add event sharing functionality
5. Implement deep linking for events

### Low Priority
1. Add dark mode toggle
2. Add language selection (Slovenian/English)
3. Add event calendar view
4. Add map view for events
5. Add event favorites/bookmarks

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- All coordinates use decimal degrees (lat/lng)
- All prices are in EUR (€)
- All distances are in kilometers (km)
- All dates/times are displayed in user's local timezone
- Backend URL is configured in `app.json` under `expo.extra.backendUrl`
- Authentication tokens are stored securely (SecureStore on native, localStorage on web)
- Session tokens are automatically refreshed every 5 minutes

---

## 🆘 Troubleshooting

### Issue: "Backend URL not configured"
**Solution**: Rebuild the app. The backend URL is injected at build time from `app.json`.

### Issue: "Authentication token not found"
**Solution**: Sign out and sign in again. The token may have expired or been cleared.

### Issue: "Location permission denied"
**Solution**: Manually select a region from the dropdown. The app works without location access.

### Issue: "Cannot see attendees"
**Solution**: You must mark the event as "Going" to see the attendee list.

### Issue: "Cannot add comment/rating"
**Solution**: Check if:
1. You're signed in
2. You marked the event as "Going"
3. The event has ended
4. It's within 7 days after the event end

### Issue: "Username already taken"
**Solution**: Choose a different username. Usernames must be unique across all users.

### Issue: Events not loading
**Solution**:
1. Check internet connection
2. Pull to refresh
3. Check if backend is running
4. Check browser console for errors

---

## 📧 Support

For issues or questions:
1. Check the console logs for error messages
2. Verify API endpoints are responding correctly
3. Check network tab in browser dev tools
4. Review this testing guide for expected behaviors

---

**Last Updated**: 2026-01-29
**App Version**: 1.0.0
**Backend URL**: http://192.168.0.38:3000

---

## ✅ CRITICAL RLS & PERMISSION TESTS (2026-01-29 Update)

### Events RLS Policies - SELECT
**Test 1.1: Anonymous user sees ONLY published events**
- [ ] Sign out (or use incognito/private browsing)
- [ ] Navigate to events feed
- [ ] Expected: Only events with `status='published'` are visible
- [ ] Expected: No draft or cancelled events visible

**Test 1.2: Authenticated user sees ONLY published events in feed**
- [ ] Sign in as regular user (role='user')
- [ ] Navigate to events feed
- [ ] Expected: Only events with `status='published'` are visible
- [ ] Expected: No draft or cancelled events visible

**Test 1.3: Organizer sees own events (all statuses) + published events**
- [ ] Sign in as organizer
- [ ] Navigate to "Moji dogodki" tab
- [ ] Expected: See ALL own events (draft, published, cancelled)
- [ ] Navigate to events feed
- [ ] Expected: See ALL published events (including from other organizers)

**Test 1.4: Admin sees ALL events**
- [ ] Sign in as admin
- [ ] Navigate to "Moji dogodki" tab
- [ ] Expected: See ALL events from ALL organizers (any status)
- [ ] Navigate to events feed
- [ ] Expected: See ALL published events

### Events RLS Policies - INSERT
**Test 2.1: Organizer can create event with own organizer_id**
- [ ] Sign in as organizer
- [ ] Navigate to "Ustvari dogodek"
- [ ] Fill in all required fields
- [ ] Expected: Event created successfully with `organizer_id = current_user_id`

**Test 2.2: Admin can create event and assign to any organizer**
- [ ] Sign in as admin
- [ ] Navigate to "Ustvari dogodek"
- [ ] Expected: See dropdown to select organizer
- [ ] Expected: Dropdown shows ONLY users with role='organizer' (NOT admins)
- [ ] Select an organizer and create event
- [ ] Expected: Event created successfully with selected `organizer_id`

**Test 2.3: Regular user CANNOT create events**
- [ ] Sign in as regular user (role='user')
- [ ] Expected: "Moji dogodki" tab is NOT visible
- [ ] Try to navigate to `/organizer/create` directly
- [ ] Expected: Redirected to home screen

### Events RLS Policies - UPDATE
**Test 3.1: Organizer can update own events**
- [ ] Sign in as organizer
- [ ] Navigate to "Moji dogodki"
- [ ] Click "Uredi" on own event
- [ ] Change title and save
- [ ] Expected: Event updated successfully

**Test 3.2: Organizer can change status from draft to published**
- [ ] Sign in as organizer
- [ ] Navigate to "Moji dogodki"
- [ ] Find a draft event
- [ ] Click "Uredi"
- [ ] Change status to "Objavljeno"
- [ ] Save
- [ ] Expected: Event updated successfully
- [ ] Navigate to events feed
- [ ] Expected: Event now visible in feed

**Test 3.3: Organizer CANNOT update other organizer's events**
- [ ] Sign in as organizer A
- [ ] Try to navigate to `/organizer/edit/[other_organizer_event_id]`
- [ ] Expected: Event not found or update fails

**Test 3.4: Admin can update ANY event**
- [ ] Sign in as admin
- [ ] Navigate to "Moji dogodki"
- [ ] Click "Uredi" on any event
- [ ] Change title and save
- [ ] Expected: Event updated successfully

### Events RLS Policies - DELETE
**Test 4.1: Organizer can delete own events**
- [ ] Sign in as organizer
- [ ] Navigate to "Moji dogodki"
- [ ] Click "Izbriši" on own event
- [ ] Confirm deletion
- [ ] Expected: Event deleted successfully
- [ ] Expected: Event removed from list immediately

**Test 4.2: Organizer CANNOT delete other organizer's events**
- [ ] Sign in as organizer A
- [ ] Try to delete organizer B's event via API or direct SQL
- [ ] Expected: Delete fails (no rows affected)

**Test 4.3: Admin can delete ANY event**
- [ ] Sign in as admin
- [ ] Navigate to "Moji dogodki"
- [ ] Click "Izbriši" on any event (even from other organizers)
- [ ] Confirm deletion
- [ ] Expected: Event deleted successfully
- [ ] Expected: Event removed from list immediately

**Test 4.4: Delete error handling**
- [ ] Sign in as organizer
- [ ] Navigate to "Moji dogodki"
- [ ] Click "Izbriši" on own event
- [ ] Simulate network error (turn off WiFi before confirming)
- [ ] Expected: Error message displayed
- [ ] Expected: Event NOT removed from list (optimistic update reverted)

### Username Login
**Test 5.1: Sign in with username**
- [ ] Sign out
- [ ] Navigate to sign in screen
- [ ] Enter username (not email) in email field
- [ ] Enter password
- [ ] Click "Sign In"
- [ ] Expected: Successfully signed in

**Test 5.2: Sign in with email (still works)**
- [ ] Sign out
- [ ] Navigate to sign in screen
- [ ] Enter email in email field
- [ ] Enter password
- [ ] Click "Sign In"
- [ ] Expected: Successfully signed in

### AbortController & Error Handling
**Test 6.1: Feed refresh doesn't show AbortError**
- [ ] Navigate to events feed
- [ ] Pull to refresh multiple times quickly
- [ ] Expected: No "Aborted" errors in console or UI
- [ ] Expected: Feed refreshes smoothly

**Test 6.2: Navigate away during fetch**
- [ ] Navigate to events feed
- [ ] Immediately navigate to profile tab
- [ ] Expected: No "Aborted" errors in console or UI

**Test 6.3: Organizer screen refresh**
- [ ] Sign in as organizer
- [ ] Navigate to "Moji dogodki"
- [ ] Pull to refresh multiple times quickly
- [ ] Expected: No "Aborted" errors in console or UI

### Feed Query - Status Filtering
**Test 7.1: Feed shows ONLY published events**
- [ ] Create a draft event as organizer
- [ ] Navigate to events feed
- [ ] Expected: Draft event NOT visible in feed
- [ ] Edit draft event and change status to "Objavljeno"
- [ ] Navigate to events feed (or refresh)
- [ ] Expected: Event NOW visible in feed

**Test 7.2: Feed shows published events from ALL organizers**
- [ ] Sign in as organizer A
- [ ] Create and publish event
- [ ] Sign out
- [ ] Sign in as organizer B
- [ ] Navigate to events feed
- [ ] Expected: See organizer A's published event

**Test 7.3: Feed shows published events to anonymous users**
- [ ] Sign out
- [ ] Navigate to events feed
- [ ] Expected: See all published events
- [ ] Expected: No draft or cancelled events

## 🔍 SQL VERIFICATION QUERIES

Run these in Supabase SQL Editor to verify RLS policies:

```sql
-- 1. Count published events (should be visible to all)
SELECT COUNT(*) FROM events WHERE status = 'published';

-- 2. Check organizer_id is NOT NULL
SELECT COUNT(*) FROM events WHERE organizer_id IS NULL;
-- Expected: 0

-- 3. Verify FK constraint exists
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_name = 'events_organizer_id_fkey';
-- Expected: 1 row

-- 4. List all RLS policies on events table
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'events';
-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- 5. Verify email column exists in profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'email';
-- Expected: 1 row (email, text)
```

## 🐛 FIXED ISSUES (2026-01-29)
- ✅ AbortError showing in console/UI → Fixed (silently ignored)
- ✅ Feed showing draft events → Fixed (strict status='published' filter)
- ✅ Organizer delete not checking error → Fixed (error checked before state update)
- ✅ Username login not working → Fixed (email stored in profiles table)
- ✅ Admin cannot delete events → Fixed (RLS DELETE policy)
- ✅ Organizer can delete other's events → Fixed (RLS DELETE policy)
- ✅ Draft→published not showing in feed → Fixed (feed query + RLS)
- ✅ events.organizer_id can be NULL → Fixed (NOT NULL constraint added)
- ✅ Duplicate/conflicting AbortController instances → Fixed (single ref per component)

## 🚀 DEPLOYMENT CHECKLIST
- [ ] All critical RLS tests pass
- [ ] No console errors during normal usage
- [ ] AbortError handling verified
- [ ] RLS policies verified via SQL
- [ ] Username login tested
- [ ] Admin permissions tested
- [ ] Organizer permissions tested
- [ ] Feed query verified (only published events)
- [ ] Draft→published transition tested
- [ ] Delete error handling tested
