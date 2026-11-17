import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client.js'

const EMPTY_ITEM = {
  category: '',
  condition: '',
  photo: null,
  photoPreviewUrl: null,
  photoUrl: null,
  photoUploadStatus: 'idle', // idle | uploading | uploaded | error
  photoUploadError: null,
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Multi-item bundle listing (spec.md §3, §6.1). Item rows (task 9.1) plus
// per-item photo upload (task 9.2): selecting a file shows an immediate
// local preview, then uploads it via POST /listings/upload-photo (backend
// wrapper around the Cloudinary helper, task 3.1/5.3) so the resulting
// photo_url is ready for whenever the form actually submits (task 9.4).
function CreateListingForm() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [submitStatus, setSubmitStatus] = useState('idle') // idle | submitting | error
  const [submitError, setSubmitError] = useState(null)

  // Pickup location (task 9.3, spec.md §6.1 step 2, LLD §5 "reverse-geocoded,
  // editable"): capturing GPS coords pre-fills the address via
  // GET /listings/reverse-geocode (task 3.5's reverseGeocode() service,
  // exposed for preview before the listing actually exists), but the donor
  // can freely overwrite it — whatever's in pickupAddressLabel when the form
  // eventually submits (task 9.4) is what's sent, auto-filled or not.
  const [pickupLat, setPickupLat] = useState(null)
  const [pickupLng, setPickupLng] = useState(null)
  const [pickupAddressLabel, setPickupAddressLabel] = useState('')
  const [locationStatus, setLocationStatus] = useState('idle') // idle | locating | located | error
  const [locationError, setLocationError] = useState(null)

  // Browsers only expose navigator.geolocation on "secure contexts" — https://
  // or http://localhost specifically. A plain http:// LAN address (e.g.
  // sharing this app with others over WiFi before a real deploy) doesn't
  // qualify, and clicking the button there fails with a confusing "denied"
  // error even though nothing was ever actually asked or denied. Hiding the
  // button there instead of showing that error, since the pickup address can
  // always be typed in manually regardless.
  const geolocationAvailable = typeof window !== 'undefined' && window.isSecureContext && !!navigator.geolocation

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      setLocationError('Geolocation is not supported by this browser')
      return
    }

    setLocationStatus('locating')
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setPickupLat(latitude)
        setPickupLng(longitude)
        setLocationStatus('located')

        try {
          const result = await apiFetch(`/listings/reverse-geocode?lat=${latitude}&lng=${longitude}`)
          setPickupAddressLabel(result.address_label)
        } catch {
          // Auto-fill failed — location itself is still captured; the donor
          // can still type the address manually.
        }
      },
      (err) => {
        setLocationStatus('error')
        setLocationError(err.message)
      },
    )
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index, patch) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  async function handlePhotoChange(index, file) {
    if (!file) {
      updateItem(index, {
        photo: null,
        photoPreviewUrl: null,
        photoUrl: null,
        photoUploadStatus: 'idle',
        photoUploadError: null,
      })
      return
    }

    const previewUrl = URL.createObjectURL(file)
    updateItem(index, {
      photo: file,
      photoPreviewUrl: previewUrl,
      photoUrl: null,
      photoUploadStatus: 'uploading',
      photoUploadError: null,
    })

    try {
      const dataUri = await readFileAsDataUrl(file)
      const result = await apiFetch('/listings/upload-photo', {
        method: 'POST',
        body: { photo: dataUri },
      })
      updateItem(index, { photoUrl: result.photo_url, photoUploadStatus: 'uploaded' })
    } catch (err) {
      updateItem(index, { photoUploadStatus: 'error', photoUploadError: err.message })
    }
  }

  // Every item needs a category, a condition, and a *successfully uploaded*
  // photo before the listing can be submitted — backend's listing_items table
  // has NOT NULL constraints on all three, and without this check the form
  // let a donor submit with an item stuck at photoUploadStatus 'idle'/'error'
  // (e.g. an unsupported image type), which surfaced as a raw 500 instead of
  // a clear validation message.
  const itemsAreValid =
    items.length > 0 &&
    items.every(
      (item) => item.category.trim() && item.condition.trim() && item.photoUploadStatus === 'uploaded',
    )
  const locationIsValid = pickupLat !== null && pickupLng !== null

  async function handleSubmit(e) {
    e.preventDefault()

    if (!itemsAreValid) {
      setSubmitStatus('error')
      setSubmitError('Each item needs a category, a condition, and a successfully uploaded photo before you can submit.')
      return
    }

    if (!locationIsValid) {
      setSubmitStatus('error')
      setSubmitError('Pickup location is required — use GPS if available, or enter latitude/longitude manually.')
      return
    }

    setSubmitStatus('submitting')
    setSubmitError(null)

    try {
      await apiFetch('/listings', {
        method: 'POST',
        body: {
          items: items.map((item) => ({
            category: item.category,
            condition: item.condition,
            photo_url: item.photoUrl,
          })),
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          pickup_address_label: pickupAddressLabel,
        },
      })
      navigate('/donor/listings')
    } catch (err) {
      setSubmitStatus('error')
      setSubmitError(err.message)
    }
  }

  return (
    <form data-testid="create-listing-form" className="donation-create-form" onSubmit={handleSubmit}>
      <h2>Donate Items</h2>
      {items.length === 0 && <p>No items added yet.</p>}
      {items.map((item, index) => (
        <div key={index} data-testid="item-row">
          <input
            type="text"
            placeholder="Category"
            aria-label="Category"
            value={item.category}
            onChange={(e) => updateItem(index, { category: e.target.value })}
          />
          <input
            type="text"
            placeholder="Condition"
            aria-label="Condition"
            value={item.condition}
            onChange={(e) => updateItem(index, { condition: e.target.value })}
          />
          <input
            type="file"
            accept="image/*"
            aria-label="Photo"
            onChange={(e) => handlePhotoChange(index, e.target.files[0] || null)}
          />
          {item.photoPreviewUrl && (
            <img src={item.photoPreviewUrl} alt="Preview" data-testid="photo-preview" width="60" height="60" />
          )}
          {item.photoUploadStatus === 'uploading' && <span data-testid="photo-status">Uploading...</span>}
          {item.photoUploadStatus === 'uploaded' && (
            <span data-testid="photo-status" data-photo-url={item.photoUrl}>
              Uploaded
            </span>
          )}
          {item.photoUploadStatus === 'error' && (
            <span data-testid="photo-status">Upload failed: {item.photoUploadError}</span>
          )}
          <button type="button" onClick={() => removeItem(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem}>
        Add item
      </button>

      <h2>Pickup Location</h2>
      {geolocationAvailable ? (
        <button type="button" onClick={captureLocation}>
          Use my current location
        </button>
      ) : (
        <div data-testid="geolocation-unavailable">
          <p>
            GPS location isn't available on this connection — enter your coordinates manually instead. (Tip: search
            your address on Google Maps, right-click your location, and tap the first line in the popup — it copies
            the latitude and longitude shown there.)
          </p>
          <label>
            Latitude
            <input
              type="number"
              step="any"
              aria-label="Latitude"
              value={pickupLat ?? ''}
              onChange={(e) => setPickupLat(e.target.value === '' ? null : Number(e.target.value))}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              aria-label="Longitude"
              value={pickupLng ?? ''}
              onChange={(e) => setPickupLng(e.target.value === '' ? null : Number(e.target.value))}
            />
          </label>
        </div>
      )}
      {locationStatus === 'locating' && <p>Locating...</p>}
      {locationStatus === 'located' && (
        <p data-testid="pickup-pin">
          📍 {pickupLat.toFixed(4)}, {pickupLng.toFixed(4)}
        </p>
      )}
      {locationStatus === 'error' && <p>Location error: {locationError}</p>}
      <label>
        Pickup address
        <input
          type="text"
          aria-label="Pickup address"
          data-testid="pickup-address-input"
          value={pickupAddressLabel}
          onChange={(e) => setPickupAddressLabel(e.target.value)}
        />
      </label>

      {submitStatus === 'error' && <p data-testid="submit-error">{submitError}</p>}
      <button type="submit" disabled={submitStatus === 'submitting' || !itemsAreValid || !locationIsValid}>
        {submitStatus === 'submitting' ? 'Submitting...' : 'Submit listing'}
      </button>
    </form>
  )
}

export default CreateListingForm
