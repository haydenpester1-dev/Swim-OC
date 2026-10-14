// Orange County freeway network.
// Waypoints are [latitude, longitude] at interchanges and major exits, traced from
// published maps of each route. The game smooths a curve through them, so interchanges
// that share a waypoint are exactly where the two freeways meet.
// Order of `pts` defines the first entry of `dirs`; the second entry is the reverse.
window.OC_DATA = {
  freeways: [
    {
      id: '5', shield: 'I', num: '5', name: 'I-5', label: 'Santa Ana / San Diego Fwy',
      lanes: 5, limit: 65, color: '#3b8eea',
      dirs: [['NORTH', 'Los Angeles'], ['SOUTH', 'San Diego']],
      pts: [
        [33.3880, -117.5900], // county line, San Onofre
        [33.4100, -117.6040], // Ave Calafia
        [33.4300, -117.6250], // San Clemente
        [33.4490, -117.6390], // Ave Pico
        [33.4640, -117.6680], // PCH / Camino Las Ramblas
        [33.5020, -117.6630], // Ortega Hwy
        [33.5170, -117.6670], // SR-73
        [33.5560, -117.6720], // Crown Valley Pkwy
        [33.5830, -117.6700], // Oso Pkwy
        [33.5960, -117.6820], // La Paz Rd
        [33.6040, -117.6960], // Alicia Pkwy
        [33.6195, -117.7065], // El Toro Rd
        [33.6290, -117.7190], // Lake Forest Dr
        [33.6395, -117.7360], // El Toro "Y" (I-405)
        [33.6625, -117.7590], // SR-133
        [33.6880, -117.7880], // Jeffrey Rd
        [33.7000, -117.8040], // Culver Dr
        [33.7175, -117.8170], // Jamboree Rd (SR-261)
        [33.7365, -117.8300], // Red Hill Ave
        [33.7445, -117.8390], // SR-55
        [33.7500, -117.8450], // 1st St
        [33.7640, -117.8600], // 17th St
        [33.7781, -117.8782], // Orange Crush (SR-22 / SR-57)
        [33.8035, -117.9110], // Katella Ave / Disney Way
        [33.8180, -117.9220], // Ball Rd
        [33.8330, -117.9400], // Lincoln Ave
        [33.8375, -117.9585], // Brookhurst St
        [33.8585, -117.9965], // Beach Blvd
        [33.8650, -118.0130], // SR-91
        [33.8745, -118.0270], // Valley View
        [33.8800, -118.0360]  // county line
      ]
    },
    {
      id: '405', shield: 'I', num: '405', name: 'I-405', label: 'San Diego Fwy',
      lanes: 5, limit: 65, color: '#e8453c',
      dirs: [['NORTH', 'Long Beach'], ['SOUTH', 'Irvine']],
      pts: [
        [33.6395, -117.7360], // El Toro "Y"
        [33.6455, -117.7480], // Irvine Center Dr
        [33.6510, -117.7570], // SR-133
        [33.6555, -117.7700], // Sand Canyon Ave
        [33.6640, -117.7830], // Jeffrey Rd
        [33.6730, -117.8000], // Culver Dr
        [33.6790, -117.8350], // Jamboree Rd
        [33.6850, -117.8620], // MacArthur Blvd
        [33.6920, -117.8830], // SR-55
        [33.6945, -117.8990], // SR-73
        [33.6995, -117.9180], // Harbor Blvd
        [33.7105, -117.9540], // Brookhurst St
        [33.7250, -117.9720], // Magnolia St
        [33.7425, -117.9885], // Beach Blvd
        [33.7560, -118.0050], // Goldenwest St
        [33.7695, -118.0300], // Bolsa Chica Rd
        [33.7770, -118.0560], // SR-22
        [33.7970, -118.0870], // I-605
        [33.8030, -118.0960]  // county line
      ]
    },
    {
      id: '55', shield: 'CA', num: '55', name: 'SR-55', label: 'Costa Mesa Fwy',
      lanes: 4, limit: 65, color: '#f2a127',
      dirs: [['NORTH', 'Riverside'], ['SOUTH', 'Newport Beach']],
      pts: [
        [33.6170, -117.9290], // PCH (Newport Blvd)
        [33.6300, -117.9230],
        [33.6480, -117.9150], // 19th St, freeway begins
        [33.6640, -117.9000], // Fair Dr
        [33.6810, -117.8920], // Baker St
        [33.6920, -117.8830], // I-405
        [33.7085, -117.8610], // Dyer Rd
        [33.7290, -117.8460], // Edinger Ave
        [33.7445, -117.8390], // I-5
        [33.7600, -117.8340], // 17th St
        [33.7790, -117.8330], // SR-22
        [33.7880, -117.8290], // Chapman Ave
        [33.8030, -117.8270], // Katella Ave
        [33.8240, -117.8220], // Lincoln Ave
        [33.8530, -117.8230]  // SR-91
      ]
    },
    {
      id: '22', shield: 'CA', num: '22', name: 'SR-22', label: 'Garden Grove Fwy',
      lanes: 4, limit: 65, color: '#9b59d0',
      dirs: [['EAST', 'Orange'], ['WEST', 'Long Beach']],
      pts: [
        [33.7770, -118.0560], // I-405
        [33.7745, -118.0220], // Valley View St
        [33.7750, -117.9890], // Beach Blvd
        [33.7740, -117.9590], // Brookhurst St
        [33.7740, -117.9380], // Euclid St
        [33.7750, -117.9180], // Harbor Blvd
        [33.7755, -117.9000], // Fairview St
        [33.7781, -117.8782], // Orange Crush
        [33.7790, -117.8670], // Main St
        [33.7790, -117.8530], // Glassell St
        [33.7790, -117.8330]  // SR-55
      ]
    },
    {
      id: '57', shield: 'CA', num: '57', name: 'SR-57', label: 'Orange Fwy',
      lanes: 4, limit: 65, color: '#2fbf71',
      dirs: [['NORTH', 'Pomona'], ['SOUTH', 'Santa Ana']],
      pts: [
        [33.7781, -117.8782], // Orange Crush
        [33.7890, -117.8790], // Chapman Ave
        [33.7965, -117.8780], // Orangewood Ave
        [33.8065, -117.8775], // Katella Ave
        [33.8330, -117.8770], // Lincoln Ave
        [33.8555, -117.8775], // SR-91
        [33.8600, -117.8770], // Orangethorpe Ave
        [33.8800, -117.8780], // Nutwood Ave
        [33.9010, -117.8840], // Imperial Hwy
        [33.9330, -117.8830], // Lambert Rd
        [33.9460, -117.8800]  // county line
      ]
    },
    {
      id: '91', shield: 'CA', num: '91', name: 'SR-91', label: 'Riverside Fwy',
      lanes: 5, limit: 65, color: '#e84393',
      dirs: [['EAST', 'Riverside'], ['WEST', 'Beach Cities']],
      pts: [
        [33.8700, -118.0450], // county line
        [33.8650, -118.0130], // I-5
        [33.8635, -117.9985], // Beach Blvd
        [33.8600, -117.9600], // Brookhurst St
        [33.8575, -117.9235], // Harbor Blvd
        [33.8560, -117.8890], // State College Blvd
        [33.8555, -117.8775], // SR-57
        [33.8545, -117.8500], // Kraemer Blvd
        [33.8530, -117.8230], // SR-55
        [33.8590, -117.7930], // Imperial Hwy
        [33.8655, -117.7480], // Weir Canyon Rd
        [33.8700, -117.7280], // SR-241
        [33.8740, -117.7030], // Gypsum Canyon Rd
        [33.8840, -117.6600]  // county line
      ]
    },
    {
      id: '73', shield: 'CA', num: '73', name: 'SR-73', label: 'San Joaquin Hills Toll Rd', toll: true,
      lanes: 3, limit: 65, color: '#d4c22a',
      dirs: [['SOUTH', 'San Juan Capistrano'], ['NORTH', 'Long Beach']],
      pts: [
        [33.6945, -117.8990], // I-405
        [33.6860, -117.8890], // SR-55
        [33.6720, -117.8780], // Bristol St / Campus Dr
        [33.6610, -117.8630], // MacArthur Blvd
        [33.6560, -117.8540], // Jamboree Rd
        [33.6450, -117.8410], // University Dr
        [33.6260, -117.8250], // Bonita Canyon Dr
        [33.6080, -117.8110], // Newport Coast Dr
        [33.5990, -117.7850],
        [33.5970, -117.7570], // SR-133
        [33.5940, -117.7350], // El Toro Rd
        [33.5700, -117.7130], // La Paz Rd
        [33.5530, -117.6900], // Greenfield Dr
        [33.5300, -117.6820],
        [33.5170, -117.6670]  // I-5
      ]
    },
    {
      id: '133', shield: 'CA', num: '133', name: 'SR-133', label: 'Laguna Fwy',
      lanes: 2, limit: 55, color: '#1abc9c',
      dirs: [['NORTH', 'Irvine'], ['SOUTH', 'Laguna Beach']],
      pts: [
        [33.5440, -117.7840], // PCH, Laguna Beach
        [33.5560, -117.7750],
        [33.5720, -117.7650], // Laguna Canyon Rd
        [33.5970, -117.7570], // SR-73
        [33.6200, -117.7550],
        [33.6400, -117.7560],
        [33.6510, -117.7570], // I-405
        [33.6625, -117.7590], // I-5
        [33.6750, -117.7480],
        [33.6900, -117.7350],
        [33.7010, -117.7220]  // SR-241
      ]
    },
    {
      id: '241', shield: 'CA', num: '241', name: 'SR-241', label: 'Foothill Toll Rd', toll: true,
      lanes: 3, limit: 65, color: '#e67e22',
      dirs: [['NORTH', 'Riverside'], ['SOUTH', 'Rancho Santa Margarita']],
      pts: [
        [33.5980, -117.6120], // Oso Pkwy
        [33.6150, -117.6200],
        [33.6380, -117.6250], // Santa Margarita Pkwy
        [33.6600, -117.6500],
        [33.6750, -117.6720], // Portola Pkwy
        [33.6900, -117.6980], // Alton Pkwy
        [33.7010, -117.7220], // SR-133
        [33.7180, -117.7330],
        [33.7520, -117.7360], // SR-261
        [33.7900, -117.7380],
        [33.8250, -117.7360],
        [33.8500, -117.7330],
        [33.8700, -117.7280]  // SR-91
      ]
    },
    {
      id: '261', shield: 'CA', num: '261', name: 'SR-261', label: 'Eastern Toll Rd', toll: true,
      lanes: 2, limit: 65, color: '#c0392b',
      dirs: [['NORTH', 'Riverside'], ['SOUTH', 'Tustin']],
      pts: [
        [33.7175, -117.8170], // I-5 / Jamboree Rd
        [33.7280, -117.8050],
        [33.7420, -117.7920], // Irvine Blvd
        [33.7550, -117.7750],
        [33.7580, -117.7550],
        [33.7520, -117.7360]  // SR-241
      ]
    },
    {
      id: '1', shield: 'CA', num: '1', name: 'PCH', label: 'Pacific Coast Hwy', surface: true,
      lanes: 2, limit: 50, color: '#5dade2',
      dirs: [['SOUTH', 'Laguna Beach'], ['NORTH', 'Huntington Beach']],
      pts: [
        [33.7480, -118.1080], // Seal Beach
        [33.7330, -118.0860],
        [33.7180, -118.0640], // Sunset Beach
        [33.7000, -118.0450], // Bolsa Chica
        [33.6800, -118.0250],
        [33.6580, -118.0010], // Main St, HB Pier
        [33.6420, -117.9790], // Beach Blvd
        [33.6330, -117.9600], // Brookhurst St
        [33.6230, -117.9420],
        [33.6170, -117.9290], // Newport Blvd (SR-55)
        [33.6150, -117.9050],
        [33.6110, -117.8800], // Jamboree Rd
        [33.5995, -117.8735], // Corona del Mar
        [33.5880, -117.8560],
        [33.5810, -117.8410], // Newport Coast Dr
        [33.5720, -117.8270], // Crystal Cove
        [33.5560, -117.8050], // Emerald Bay
        [33.5440, -117.7840], // Laguna Beach (SR-133)
        [33.5300, -117.7700],
        [33.5110, -117.7530], // Aliso Beach
        [33.4950, -117.7380], // South Laguna
        [33.4800, -117.7200],
        [33.4710, -117.7050], // Dana Point Harbor
        [33.4660, -117.6880],
        [33.4640, -117.6680]  // I-5
      ]
    }
  ],

  // Coastline south of where PCH meets I-5 (San Clemente), used to draw the ocean.
  coastSouth: [
    [33.4580, -117.6720], [33.4400, -117.6460], [33.4190, -117.6240],
    [33.4000, -117.6060], [33.3800, -117.5850], [33.3500, -117.5500]
  ],

  // Named exits. Every exit can be a mission destination.
  exits: [
    { id: 'ortega', fwy: '5', at: [33.5020, -117.6630], name: 'Ortega Hwy', place: 'Mission San Juan Capistrano' },
    { id: 'crownvalley', fwy: '5', at: [33.5560, -117.6720], name: 'Crown Valley Pkwy', place: 'Mission Viejo' },
    { id: 'eltoro', fwy: '5', at: [33.6195, -117.7065], name: 'El Toro Rd', place: 'Lake Forest' },
    { id: 'culver5', fwy: '5', at: [33.7000, -117.8040], name: 'Culver Dr', place: 'Irvine' },
    { id: 'disney', fwy: '5', at: [33.8035, -117.9110], name: 'Katella Ave / Disney Way', place: 'Disneyland Resort' },
    { id: 'beach5', fwy: '5', at: [33.8510, -117.9830], name: 'Beach Blvd', place: 'Buena Park' },
    { id: 'spectrum', fwy: '5', at: [33.6500, -117.7465], name: 'Alton Pkwy', place: 'Irvine Spectrum' },
    { id: 'jeffrey405', fwy: '405', at: [33.6640, -117.7830], name: 'Jeffrey Rd', place: 'Irvine' },
    { id: 'sna', fwy: '405', at: [33.6850, -117.8620], name: 'MacArthur Blvd', place: 'John Wayne Airport' },
    { id: 'harbor405', fwy: '405', at: [33.6995, -117.9180], name: 'Harbor Blvd', place: 'Costa Mesa' },
    { id: 'beach405', fwy: '405', at: [33.7425, -117.9885], name: 'Beach Blvd', place: 'Westminster' },
    { id: 'fair', fwy: '55', at: [33.6640, -117.9000], name: 'Fair Dr', place: 'OC Fair & Event Center' },
    { id: 'dyer', fwy: '55', at: [33.7085, -117.8610], name: 'Dyer Rd', place: 'Santa Ana' },
    { id: 'oldtowne', fwy: '55', at: [33.7880, -117.8290], name: 'Chapman Ave', place: 'Old Towne Orange' },
    { id: 'angels', fwy: '57', at: [33.7965, -117.8780], name: 'Orangewood Ave', place: 'Angel Stadium' },
    { id: 'honda', fwy: '57', at: [33.8090, -117.8775], name: 'Katella Ave', place: 'Honda Center' },
    { id: 'csuf', fwy: '57', at: [33.8800, -117.8780], name: 'Nutwood Ave', place: 'Cal State Fullerton' },
    { id: 'brea', fwy: '57', at: [33.9010, -117.8840], name: 'Imperial Hwy', place: 'Brea Mall' },
    { id: 'harbor22', fwy: '22', at: [33.7750, -117.9180], name: 'Harbor Blvd', place: 'Garden Grove' },
    { id: 'knotts', fwy: '91', at: [33.8635, -117.9985], name: 'Beach Blvd', place: "Knott's Berry Farm" },
    { id: 'fullerton', fwy: '91', at: [33.8575, -117.9235], name: 'Harbor Blvd', place: 'Downtown Fullerton' },
    { id: 'weir', fwy: '91', at: [33.8655, -117.7480], name: 'Weir Canyon Rd', place: 'Anaheim Hills' },
    { id: 'fashion', fwy: '73', at: [33.6560, -117.8540], name: 'Jamboree Rd', place: 'Fashion Island' },
    { id: 'uci', fwy: '73', at: [33.6450, -117.8410], name: 'University Dr', place: 'UC Irvine' },
    { id: 'newportcoast', fwy: '73', at: [33.6080, -117.8110], name: 'Newport Coast Dr', place: 'Newport Coast' },
    { id: 'rsm', fwy: '241', at: [33.6380, -117.6250], name: 'Santa Margarita Pkwy', place: 'Rancho Santa Margarita' },
    { id: 'hbpier', fwy: '1', at: [33.6580, -118.0010], name: 'Main St', place: 'Huntington Beach Pier' },
    { id: 'balboa', fwy: '1', at: [33.6110, -117.8800], name: 'Jamboree Rd', place: 'Balboa Island' },
    { id: 'crystalcove', fwy: '1', at: [33.5720, -117.8270], name: 'Crystal Cove', place: 'Crystal Cove State Park' },
    { id: 'laguna', fwy: '1', at: [33.5330, -117.7730], name: 'Thalia St', place: 'Laguna Beach' },
    { id: 'danapoint', fwy: '1', at: [33.4710, -117.7050], name: 'Dana Point Harbor Dr', place: 'Dana Point Harbor' }
  ],

  // Hand-made commutes. `start` is a freeway, a direction index into `dirs`, and a point.
  missions: [
    { title: 'Happiest Commute', blurb: 'Irvine Spectrum to Disneyland on I-5. Watch the Orange Crush.',
      start: { fwy: '405', dir: 0, at: [33.6555, -117.7700] }, dest: 'disney' },
    { title: 'Game Day', blurb: 'Buena Park to the Big A before first pitch.',
      start: { fwy: '5', dir: 1, at: [33.8700, -118.0200] }, dest: 'angels' },
    { title: 'Catch Your Flight', blurb: 'Fullerton to John Wayne. TSA waits for no one.',
      start: { fwy: '91', dir: 0, at: [33.8590, -117.9500] }, dest: 'sna' },
    { title: 'Beach Day', blurb: 'Brea down to the Huntington Beach Pier.',
      start: { fwy: '57', dir: 1, at: [33.9250, -117.8830] }, dest: 'hbpier' },
    { title: 'Laguna Sunset', blurb: 'San Clemente up the coast to Laguna Beach.',
      start: { fwy: '5', dir: 0, at: [33.4050, -117.6000] }, dest: 'laguna' },
    { title: 'Toll Road Express', blurb: 'From the Riverside line to the Spectrum. The 241 is your friend.',
      start: { fwy: '91', dir: 1, at: [33.8800, -117.6750] }, dest: 'spectrum' },
    { title: '8 AM Lecture', blurb: 'Garden Grove to UC Irvine. Class starts in minutes.',
      start: { fwy: '22', dir: 0, at: [33.7745, -118.0100] }, dest: 'uci' },
    { title: 'Knott’s Run', blurb: 'Costa Mesa to Knott’s Berry Farm before the lines get long.',
      start: { fwy: '55', dir: 0, at: [33.6600, -117.9050] }, dest: 'knotts' },
    { title: 'Harbor Cruise', blurb: 'Seal Beach down PCH to Dana Point Harbor.',
      start: { fwy: '405', dir: 1, at: [33.7900, -118.0750] }, dest: 'danapoint' },
    { title: 'Night Game at the Pond', blurb: 'Lake Forest to the Honda Center for puck drop.',
      start: { fwy: '5', dir: 0, at: [33.6100, -117.7000] }, dest: 'honda' }
  ],

  landmarks: [
    { kind: 'bigA', at: [33.8003, -117.8827] },
    { kind: 'matterhorn', at: [33.8125, -117.9180] },
    { kind: 'arena', at: [33.8078, -117.8740] },
    { kind: 'wheel', at: [33.6505, -117.7435] },
    { kind: 'balloon', at: [33.6720, -117.7380] },
    { kind: 'pier', at: [33.6553, -118.0050] },
    { kind: 'towers', at: [33.6870, -117.8500], n: 10 },   // Irvine business district
    { kind: 'towers', at: [33.6930, -117.8880], n: 6 },    // South Coast Metro
    { kind: 'towers', at: [33.7530, -117.8680], n: 5 },    // Santa Ana civic center
    { kind: 'towers', at: [33.7900, -117.8850], n: 4 }     // The City / Orange
  ],

  // Santa Ana Mountains and San Joaquin Hills (lat, lon, radius km, height m)
  mountains: [
    [33.7110, -117.5340, 7, 900], [33.7600, -117.5700, 6, 700], [33.8150, -117.6200, 5, 520],
    [33.6500, -117.5500, 6, 640], [33.6000, -117.5200, 6, 600], [33.8600, -117.6300, 4, 380],
    [33.7300, -117.6400, 4, 360], [33.7900, -117.6800, 3.5, 300], [33.6150, -117.8300, 2.2, 160],
    [33.5900, -117.8000, 2.5, 190], [33.5650, -117.7600, 2.2, 170], [33.6200, -117.7900, 1.8, 130],
    [33.5400, -117.7400, 2.0, 150], [33.9300, -117.8200, 3.0, 220], [33.9400, -117.9300, 2.5, 160],
    [33.4500, -117.5800, 4.0, 300], [33.5000, -117.6000, 3.0, 230]
  ]
};
