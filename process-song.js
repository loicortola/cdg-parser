const fs = require('fs');
const path = require('path');
const Promise = require("bluebird");
require('node-zip');

const mkdirp = Promise.promisify(require('mkdirp'));
const writeFile = Promise.promisify(fs.writeFile);
const access = Promise.promisify(fs.access);

const getCdgFile = (root, name) => {
  let cdgFile = path.join(root, name + '.cdg');
  try {
    fs.accessSync(cdgFile);
    return cdgFile;
  } catch (err) {
    cdgFile = path.join(root, name + '.CDG');
    try {
      fs.accessSync(cdgFile);
      return cdgFile;
    } catch (err2) {
      return;
    }
  }
};

const getMp3File = (root, name) => {
  let mp3File = path.join(root, name + '.mp3');
  try {
    fs.accessSync(mp3File);
    return mp3File;
  } catch (err) {
    mp3File = path.join(root, name + '.MP3');
    try {
      fs.accessSync(mp3File);
      return mp3File;
    } catch (err2) {
      return;
    }
  }
};

const alreadyLocked = (lockFile, callback) => {
  fs.access(lockFile, (err) => {
      callback(!err);
  });
};

const lockOrWaitThenProcess = (lockFile, processor, maxRetries) => {
  if (maxRetries <= 0) {
    throw new Error('Locked for too long!');
  }
  alreadyLocked(lockFile, (locked) => {
    if (locked) {
      setTimeout(() => lockOrWaitThenProcess(lockFile, processor, --maxRetries), 300);
    } else {
      // Create lock (blocking)
      fs.closeSync(fs.openSync(lockFile, 'w'));
      processor();
    }
  });
};

/**
 * Process a karaoke song
 * @param config
 * @param root
 * @param collection
 * @param name
 * @param callback
 */
const processSong = (config, root, collection, name, callback) => {
  console.log('Will process song ' + name + ' in ' + root);
  // File names
  let cdgFile = getCdgFile(root, name);
  const mp3File = getMp3File(root, name);
  if (!cdgFile || !mp3File) {
    callback('Cannot find either CDG or MP3 file for ' + root + '/' + name);
  }
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
  const lockFile = path.join('output', newName + '.lock');
  // We create a lock to tell we are going to write this song (avoids duplicates)
  const zippedData = compressSongData(cdgFile, mp3File, newName);
  // This is blocking, obviously
  
  const processor = () => {
    access(destFile, fs.constants.F_OK)
        .then(() => {
          // File existed ==> duplicate
          return {directory: path.join('output', 'duplicates', firstFolder), file: newName + '.zip', isDuplicate: true};
        })
        .catch(() => {
          // File does not exist
          return {directory: path.join('output', 'processed', firstFolder, secondFolder), file: newName + '.zip'};
        })
        .then((dest) => {
          mkdirp(dest.directory)
              .then(() => {
                writeFile(path.join(dest.directory, dest.file), zippedData, 'binary')
                    .then(() => {
                      fs.unlink(lockFile, (err) => {
                        if (err) {
                          throw new Error('Failed to remove lock ' + lockFile);  
                        }
                      });
                      song.isDuplicate = dest.isDuplicate || false;
                      callback(null, song);
                    })
                    .catch((err) => {
                      fs.unlink(lockFile, (err) => {
                        if (err) {
                          throw new Error('Failed to remove lock ' + lockFile);
                        }
                      });
                      callback(err);
                    });
              })
              .catch((err) => {
                callback('Error creating sub directories. Should not happen.\n' + err, song);
              });
        });
  };
  
  lockOrWaitThenProcess(lockFile, processor, 5);
  
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
module.exports = (config, root, collection, name, callback) => {
  processSong(config, root, collection, name, callback);
};