const Promise = require('bluebird');
require('node-zip');
const fs = require('fs');
const path = require('path');

const mkdirp = Promise.promisify(require('mkdirp'));
const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);
const access = Promise.promisify(fs.access);
const unlink = Promise.promisify(fs.unlink);
const readdir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);

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
  return zip.generate({base64: false, compression: 'DEFLATE'});
};

/**
 * Get file with either lower or upper case extension
 * @param root the folder
 * @param name the file name (without extension)
 * @param ext the file extension (with dot. Ex: .zip)
 * @returns {string} or undefined if no file is found
 */
const getFileSync = (root, name, ext) => {
  let file = path.join(root, name + ext.toLowerCase());
  try {
    fs.accessSync(file);
    return file;
  } catch (err) {
  }
  file = path.join(root, name + ext.toUpperCase());
  try {
    fs.accessSync(file);
    return file;
  } catch (err) {
  }
  return;
};

/**
 * Copy input file to error directory
 * @param config the configuration
 * @param input the input file path
 * @param output the output file name
 */
const copyToError = (config, input, output) => {
  fs.createReadStream(input).pipe(fs.createWriteStream(path.join(config.outputDir, 'errors', output)));
};

/**
 * Copy input file to output file
 * @param input file
 * @param output file
 */
const copyTo = (input, output) => {
  fs.createReadStream(input).pipe(fs.createWriteStream(output));
};

/**
 * Check whether lockfile is already present or not
 * @param lockFile the lockfile
 * @param callback the callback once response is ready
 */
const alreadyLocked = (lockFile, callback) => {
  fs.access(lockFile, (err) => {
    callback(!err);
  });
};

/**
 * Attempt to remove lock
 * @param lockFile
 * @param maxRetries
 * @param callback
 */
const removeLock = (lockFile, maxRetries, callback) => {
  // Remove lock
  unlink(lockFile)
      .then(() => {
        // Finish processing and callback
        callback();
      })
      .catch((err) => {
        if (err.code === 'ENOENT') {
          callback();
        } else if (maxRetries > 0) {
          setTimeout(() => removeLock(lockFile, --maxRetries, callback), 100 + Math.random() * 50);
        } else {
          console.error(err);
          throw new Error('Failed to remove lock for file ' + lockFile);
        }
      });
};

/**
 * Will check whether lock if present or not. If lock is present, will re-attempt until timeout is reached.
 * When lock is gone, will call processor function
 * @param lockFile
 * @param processor (err) => {}
 * @param maxRetries
 */
const lockOrWaitThenProcess = (lockFile, processor, maxRetries) => {
  if (maxRetries <= 0) {
    processor(new Error('Locked for too long!'));
  }
  alreadyLocked(lockFile, (locked) => {
    if (locked) {
      setTimeout(() => lockOrWaitThenProcess(lockFile, processor, --maxRetries), 200 + Math.random() * 100);
    } else {
      // Create lock (blocking)
      fs.closeSync(fs.openSync(lockFile, 'w'));
      processor();
    }
  });
};

/**
 * Store song archive at destination
 * @param song the song metadata
 * @param lockFile the lockfile to remove after done
 * @param dest the destination zip path
 * @param zippedData the zip data
 * @param callback the callback(err, song) once done
 */
const storeZip = (song, lockFile, dest, zippedData, callback) => {
  // Create destination directory recursively
  mkdirp(dest.directory)
      .then(() => {
        // Write zip file in destination
        writeFile(path.join(dest.directory, dest.file), zippedData, 'binary')
            .then(() => {
              // Remove lock
              removeLock(lockFile, 8, () => {
                // Finish processing and callback
                song.isDuplicate = dest.isDuplicate || false;
                callback(null, song);
              });
            })
            .catch((err) => {
              removeLock(lockFile, 8, () => {
                callback(err);
              });
            });
      })
      .catch((err) => {
        callback('Error creating sub directories. Should not happen.\n' + err, song);
      });
};

/**
 * Store song archive at destination
 * @param song the song metadata
 * @param lockFile the lockfile to remove after done
 * @param dest the destination zip path
 * @param zipFile the zip file
 * @param callback the callback(err, song) once done
 */
const storeExistingZip = (song, lockFile, dest, zipFile, callback) => {
  // Create destination directory recursively
  mkdirp(dest.directory)
      .then(() => {
        // Write zip file in destination
        try {
          copyTo(zipFile, path.join(dest.directory, dest.file));
          // Remove lock
          removeLock(lockFile, 8, () => {
            // Finish processing and callback
            song.isDuplicate = dest.isDuplicate || false;
            callback(null, song);
          });
        } catch (err) {
          removeLock(lockFile, 8, () => {
            callback(err);
          });
        }
      })
      .catch((err) => {
        callback('Error creating sub directories. Should not happen.\n' + err, song);
      });
};

module.exports = {
  storeExistingZip,
  storeZip,
  lockOrWaitThenProcess,
  copyTo,
  copyToError,
  getFileSync,
  compressSongData,
  mkdirp,
  writeFile,
  access,
  unlink,
  readdir,
  readFile,
  stat
};