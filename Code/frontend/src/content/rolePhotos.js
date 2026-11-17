const pexelsPhoto = (filename, photographer, photoPage, alt, caption) => ({
  src: `/images/${filename}`,
  photographer,
  photoPage,
  alt,
  caption,
})

const pexelsRemotePhoto = (id, photographer, photoPage, alt, caption) => ({
  src: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1800`,
  photographer,
  photoPage,
  alt,
  caption,
  label: caption,
})

export const donorSlides = [
  {
    ...pexelsRemotePhoto(
      15311442,
      'Akh Taufiq',
      'https://www.pexels.com/photo/volunteers-handing-clothes-to-children-15311442/',
      'Community volunteers hand clean clothing to children at an outdoor distribution.',
      'Clothing delivered with care',
    ),
    caption: 'Clothing delivered with care',
  },
  {
    ...pexelsRemotePhoto(
      10401890,
      'Maria Verkhoturtseva',
      'https://www.pexels.com/photo/child-wearing-a-sweater-smiling-10401890/',
      'A child smiles in a warm sweater outdoors.',
      'A warm layer, worn with joy',
    ),
    caption: 'A warm layer, worn with joy',
  },
  {
    caption: 'A gift, worn with joy',
    pair: [
      pexelsRemotePhoto(
        6347738,
        'Liza Summer',
        'https://www.pexels.com/photo/cheerful-woman-with-donation-box-6347738/',
        'A woman smiles while holding a box for clothing donations.',
        '',
      ),
      pexelsRemotePhoto(
        36066646,
        'Volkan Yılmaz',
        'https://www.pexels.com/photo/young-girl-in-warm-coat-portrait-on-a-cold-day-36066646/',
        'A child smiles in a warm coat outdoors.',
        '',
      ),
    ],
  },
]

export const ngoSlides = [
  pexelsPhoto(
    'login-ngo-pack.jpg',
    'Julia M. Cameron',
    'https://www.pexels.com/photo/volunteers-packing-clothes-6995047/',
    'Volunteers organize and pack donated clothes indoors.',
    'Prepare each donation together',
  ),
  pexelsPhoto(
    'login-ngo-handoff.jpg',
    'Julia M. Cameron',
    'https://www.pexels.com/photo/a-man-and-a-woman-holding-donations-6994940/',
    'Two NGO volunteers hold clothing and donation boxes at a community drive.',
    'Coordinate a thoughtful handoff',
  ),
  pexelsRemotePhoto(
    6995106,
    'Julia M. Cameron',
    'https://www.pexels.com/photo/a-group-of-volunteers-sorting-clothes-into-containers-posing-together-6995106/',
    'A diverse team of volunteers smiles together at a clothing donation center.',
    'Make the work a team effort',
  ),
]

export const adminSlides = [
  pexelsPhoto(
    'login-admin-review.jpg',
    'Gustavo Fring',
    'https://www.pexels.com/photo/close-up-photo-of-donation-boxes-7156156/',
    'A volunteer checks donation boxes and records details on a clipboard.',
    'Keep each donation on track',
  ),
  pexelsPhoto(
    'login-admin-sort.jpg',
    'Julia M. Cameron',
    'https://www.pexels.com/photo/woman-with-dreadlocks-sorting-clothes-6994833/',
    'A volunteer carefully sorts clothing at an indoor donation center.',
    'Review listings with care',
  ),
  pexelsPhoto(
    'login-admin-welcome.jpg',
    'Julia M. Cameron',
    'https://www.pexels.com/photo/man-holding-a-plastic-container-and-smiling-6994888/',
    'A volunteer holds a container of clothing at a community center.',
    'Keep community partners connected',
  ),
]
