const fs = require('fs');
const path = require('path');
const Promise = require("bluebird");
require('node-zip');

const mkdirp = Promise.promisify(require('mkdirp'));
const writeFile = Promise.promisify(fs.writeFile);
const access = Promise.promisify(fs.access);

/**
 * Process a karaoke song
 * @param config
 * @param root
 * @param name
 * @param callback
 */
const processSong = (config, root, name, callback) => {
  console.log('Will process song ' + name + ' in ' + root);
  // File names
  const cdgFile = path.join(root, name + '.cdg');
  const mp3File = path.join(root, name + '.mp3');
  // Config pattern
  const pattern = new RegExp(config.pattern);
  // Split content
  const match = pattern.exec(name);
  const song = {};
  // Parse meta-data into song object
  for (let i = 0; i < config.mapping.length; i++) {
    song[config.mapping[i]] = match[i + 1];
  }
  // Ensure we have artist and title
  if (!song.artist || !song.title) {
    console.error('Song was not parsed successfully');
    fs.createReadStream(cdgFile).pipe(fs.createWriteStream(path.join('output', 'errors', name + '.cdg')));
    fs.createReadStream(mp3File).pipe(fs.createWriteStream(path.join('output', 'errors', name + '.mp3')));
    callback('Error parsing song. Should not happen.\n');
  }
  // Compute new name
  const newName = song.artist + ' -- ' + song.title;

  const firstFolder = song.artist.replace(/[-_]/, '').substr(0, 1).toUpperCase();
  const secondFolder = song.artist.replace(/[-_]/, '').substr(0, 2).toUpperCase();

  const destDirectory = path.join('output', 'processed', firstFolder, secondFolder);
  const destFile = path.join(destDirectory, newName + '.zip');

  access(destFile, fs.constants.F_OK)
      .then(() => {
        // File existed ==> duplicate
        return {directory: path.join('output', 'duplicates', firstFolder), file: newName + '.zip'};
      })
      .catch(() => {
        // File does not exist
        return {directory: path.join('output', 'processed', firstFolder, secondFolder), file: newName + '.zip'};
      })
      .then((dest) => {
        mkdirp(dest.directory)
            .then(() => {
              const zippedData = compressSongData(cdgFile, mp3File, newName);
              writeFile(path.join(dest.directory, dest.file), zippedData, 'binary')
                  .then(() => {
                    callback(null, song);
                  });
            })
            .catch((err) => {
              callback('Error creating sub directories. Should not happen.\n' + err, song);
            });
      });
};

/**
 * Compress song data into destination zip
 * @param cdgFile
 * @param mp3File
 * @param destName
 * @returns {*} zip binary data
 */
const compressSongData = (cdgFile, mp3File, destName) => {
  const zip = new JSZip();
  zip.file(destName + '.cdg', fs.readFileSync(cdgFile));
  zip.file(destName + '.mp3', fs.readFileSync(mp3File));
  return zip.generate({ base64: false, compression: 'DEFLATE' });
};

// create a worker and register public functions
module.exports = (config, root, name, callback) => {
  processSong(config, root, name, callback);
};