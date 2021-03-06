const fs = require('fs');
const path = require('path');
const ioUtils = require('./io-utils');
const stringUtils = require('./string-utils');

/**
 * Process a karaoke song
 * @param config
 * @param root
 * @param collection
 * @param name
 * @param id
 * @param callback
 */
const processZip = (config, root, collection, name, id, callback) => {
  if (config.debug) {
    console.log('Will process zip ' + name + ' in ' + root);
  }
  // Retrieve files and check that they exist
  const zipFile = ioUtils.getFileSync(root, name, '.zip');

  if (!zipFile) {
    callback('Cannot find either ZIP file for ' + root + '/' + name);
    return;
  }

  const song = stringUtils.parseSongMetadata(config, name, id);

  // Ensure we have artist and title
  if (!song.artist || !song.title) {
    ioUtils.copyToError(config, zipFile, name + '.zip');
    callback('Error parsing zip. Should not happen.\n');
    return;
  }

  // Compute new name
  const newName = song.getSongName();

  // We will create a lock to tell we are going to write this song (avoids duplicates)
  const lockFile = path.join(config.outputDir, newName + '.lock');

  // Generate processing function
  const processor = getProcessor(config.outputDir, song, newName, lockFile, zipFile, callback);
  // Lock or wait for lock to be freed
  ioUtils.lockOrWaitThenProcess(lockFile, processor, 5);
};

/**
 * This function creates the specific data processor for the song to store
 * @param outputDir
 * @param song
 * @param newName
 * @param lockFile
 * @param zipFile
 * @param callback(err, song)
 * @returns {function()}
 */
const getProcessor = (outputDir, song, newName, lockFile, zipFile, callback) => {
  // Compute folder hierarchy
  const firstFolder = song.artist.replace(/[-_'\\s]/, '').substr(0, 1).toUpperCase();
  const secondFolder = song.artist.replace(/[-_'\\s]/, '').substr(0, 2).toUpperCase();

  // Compute destination files and directories
  const destDirectory = path.join(outputDir, 'processed', firstFolder, secondFolder);
  const destFile = path.join(destDirectory, newName + '.zip');

  return () => {
    ioUtils.access(destFile)
        .then(() => {
          // File existed ==> duplicate
          return {directory: path.join(outputDir, 'duplicates', firstFolder), file: newName + '.zip', isDuplicate: true};
        })
        .catch(() => {
          // File does not exist
          return {directory: path.join(outputDir, 'processed', firstFolder, secondFolder), file: newName + '.zip'};
        })
        .then((dest) => {
          ioUtils.storeExistingZip(song, lockFile, dest, zipFile, callback);
        });
  };
};

// create a worker and register public functions
module.exports = (config, root, collection, name, id, callback) => {
  processZip(config, root, collection, name, id, callback);
};
