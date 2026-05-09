# Quick Reference Guide - Profile Photo Upload

## What Changed?

### ❌ REMOVED
- Dedicated "Profile Photo Section" from student_profile.html
- Separate upload button and photo preview area on profile page
- Static ALS logo from sidebar

### ✅ ADDED
- Clickable circular profile photo in sidebar header
- Clickable photo area in profile header
- Camera icon overlay that appears on hover
- Photo upload functionality to both locations
- JavaScript handlers for upload/display

## How to Use (User Perspective)

### Upload Photo
1. Click your profile photo in the **sidebar header** OR in the **profile header**
2. Select an image file from your computer
3. File uploads automatically
4. Photo displays in both locations

### Requirements
- File format: JPG, PNG, GIF, or WebP
- File size: Less than 5MB
- Recommended: 400x400px or larger

## Files Modified

| File | Changes |
|------|---------|
| `HTML/student_profile.html` | Removed photo section, updated profile header |
| `COMPONENTS/student_sidebar.html` | Replaced logo with clickable photo area |
| `JS/student_profile.js` | Added displayPhoto, handlePhotoUpload, removePhoto |
| `CSS/student_styles.css` | Added sidebar photo styling & hover effects |
| `CSS/student_profile.css` | Updated profile header photo styling |

## Key Features

✨ **Sidebar Profile Photo**
- Circular 80x80px photo
- Camera icon appears on hover
- Click anywhere to upload
- Shows placeholder if no photo

✨ **Profile Header Photo**
- Large 150x150px photo
- Integrated with profile info
- Shows placeholder if no photo
- Clickable area

✨ **Smart Validation**
- File type validation (client & server)
- File size validation (5MB max)
- User-friendly error messages
- Real-time feedback

✨ **Database Storage**
- Photo filename stored in `als_enrollments_approved.profile_photo`
- Files saved in `COMPONENTS/PFP/` folder
- Filename format: `{user_id}_{timestamp}.{extension}`

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/student-profile/{user_id}/photo` | Upload new photo |
| DELETE | `/api/student-profile/{user_id}/photo` | Delete photo |
| GET | `/profile-photo/{filename}` | Retrieve photo file |

## Testing Checklist

- [ ] Click sidebar profile photo
- [ ] Upload valid image file
- [ ] Photo appears in sidebar
- [ ] Photo appears in profile header
- [ ] Click profile header photo
- [ ] Upload another image
- [ ] New photo replaces old one
- [ ] Try uploading non-image file (should error)
- [ ] Try uploading file > 5MB (should error)
- [ ] Refresh page - photo still shows
- [ ] Log out and log back in - photo still shows

## Troubleshooting

**Photo doesn't display after upload**
- Check browser console for errors
- Verify backend is running
- Check that COMPONENTS/PFP/ folder exists

**Upload fails with error message**
- Check file type (must be image)
- Check file size (must be < 5MB)
- Check browser console for details

**Photo shows in sidebar but not profile header**
- Page may still be loading
- Refresh the page
- Check developer tools for console errors

**Photo not persisting after refresh**
- Verify backend saved the filename to database
- Check supabase connection
- Check network requests in browser dev tools

## Technical Notes

- Uses FormData API for file upload
- Filename includes timestamp to prevent collisions
- Backend validates file type and size again (security)
- Photos served via `/profile-photo/` endpoint for consistency
- Support for responsive design with proper scaling

## Database Column

```sql
-- In als_enrollments_approved table
profile_photo VARCHAR(255)  -- Stores filename only, not file path
```

Example value: `550e8400-e29b-41d4-a716-446655440000_20250111_120530.jpg`

## Important Notes

⚠️ **BREAKING CHANGES**
- Old photo upload button is gone from profile page
- Users must click their profile photo to upload (in sidebar or header)

⚠️ **MIGRATION NOTE**
- If users had photos previously, filenames must already be in database
- Photos must be in COMPONENTS/PFP/ folder
- Old photos will display correctly if filenames are intact

## Need Help?

Check these files for detailed documentation:
- `IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `ARCHITECTURE_DIAGRAM.md` - Architecture & data flow diagrams
- `JS/student_profile.js` - Photo handling functions
- `CSS/student_styles.css` - Sidebar photo styling
- `CSS/student_profile.css` - Profile header photo styling
