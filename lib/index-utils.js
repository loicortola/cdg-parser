const fs = require('fs');
const path = require('path');
const stringUtils = require('./string-utils');
/**
 * Save index by artist
 * @param songs
 */
const createSongIndexByArtist = (outputDir, songs) => {
  songs.sort((a, b) => {
    if (a.artist === b.artist) {
      return a.title > b.title ? 1 : -1;
    }
    return a.artist > b.artist ? 1 : -1;
  });
  let index = fs.createWriteStream(path.join(outputDir, 'index-by-artist.csv'), {
    flags: 'w'
  });
  let previousArtist = null;
  songs.forEach((s) => {
    if (s.artist !== previousArtist) {
      previousArtist = s.artist;
      index.write('------' + s.artist.toUpperCase() + '------\r\n');
    }
    index.write(stringUtils.pad(s.id) + ' - ' + s.title + '\r\n');
  });
  index.end()
};

/**
 * Save index by title
 * @param songs the songs
 */
const createSongIndexByTitle = (outputDir, songs) => {
  songs.sort((a, b) => {
    if (a.title === b.title) {
      return a.artist > b.artist ? 1 : -1;
    }
    return a.title > b.title ? 1 : -1;
  });
  const index = fs.createWriteStream(path.join(outputDir, 'index-by-title.csv'), {
    flags: 'w'
  });
  songs.forEach((s) => {
    index.write(stringUtils.pad(s.id) + ' - ' + s.title + ' -- ' + s.artist + '\r\n');
  });
  index.end()
};

/**
 * Save index as JSON file (for web display)
 * @param songs the songs
 */
const saveIndex = (outputDir, songs) => {
  const index = fs.createWriteStream(path.join(outputDir, 'index.json'), {
    flags: 'w'
  });
  index.write(JSON.stringify(songs));
  index.end();
};


/**
 * Save index as JSON file (for web display)
 * @param outputDir
 */
const loadPreviousIndex = (outputDir) => {
  return JSON.parse(fs.readFileSync(path.join(outputDir, 'index.json')));
};

module.exports = {
  saveIndex,
  loadPreviousIndex,
  createSongIndexByArtist,
  createSongIndexByTitle
};