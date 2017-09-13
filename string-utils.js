const Song = require('./song');

/**
 * Pad leading zeros to have '6' digits total
 * @param n the number to pad
 * @returns {*}
 */
const pad = (n) => {
  const width = 6;
  z = '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

/**
 * Format String in title case.
 * Every Word Will Start By A Capital Letter
 * @param str
 * @returns {XML|string|void|*}
 */
const formatString = (str) => {
  return str.trim().replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

/**
 * Parse metadata of song
 * @param config parser config
 * @param name the song full name
 */
const parseSongMetadata = (config, name) => {
  // Config pattern
  const pattern = new RegExp(config.pattern);
  // Split content
  const match = pattern.exec(name);
  const song = new Song();
  // Parse meta-data into song object
  if (match) {
    for (let i = 0; i < config.mapping.length; i++) {
      song[config.mapping[i]] = formatString(match[i + 1]);
    }
  }
  return song;
};


module.exports = {
  pad,
  formatString,
  parseSongMetadata
};