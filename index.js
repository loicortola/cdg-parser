const fs = require('fs');
const path = require('path');

const ioUtils = require('./lib/io-utils');
const indexUtils = require('./lib/index-utils');

const workerFarm = require('worker-farm');
const workers = workerFarm(require.resolve('./lib/process-song'));
const workersZip = workerFarm(require.resolve('./lib/process-zip'));

/**
 * Write songs in a file when done
 * @param songs
 */
const finish = (songs) => {
  // Kill farms
  workerFarm.end(workers);
  workerFarm.end(workersZip);
  // Create indexes
  indexUtils.createSongIndexByArtist(songs);
  indexUtils.createSongIndexByTitle(songs);
  indexUtils.saveIndex(songs);
};

/**
 * Read all inputs
 */
const readInputs = () => {
  let allSongs = [];

  ioUtils.readdir('./input')
      .then((files) => {
        files.forEach((f) => {
          const karaokeRoot = './input/' + f;
          const parserFile = karaokeRoot + '/parser.json';
          ioUtils.access(parserFile, fs.constants.F_OK)
              .then(() => {
                // File parser.js exists, we are in an official karaoke directory.
                console.log('Parser file found: ' + parserFile);
                let folderCount = 0;
                ioUtils.readFile(parserFile, {encoding: 'utf8'})
                    .then((data) => {
                      folderCount++;
                      processFolder(karaokeRoot, f, JSON.parse(data), (songs) => {
                        console.log('Finished processing folder');
                        allSongs = allSongs.concat(songs);
                        --folderCount;
                        if (folderCount == 0) {
                          finish(allSongs);
                        }
                      });
                    })
                    .catch((err) => {
                      throw err;
                    });
              })
              .catch((err) => {
                // This means parser.json does not exist.
              });
        });
      })
      .catch((err) => {
        throw err;
      });
};


/**
 * Process a karaoke folder
 * @param root the root folder containing the first level of songs
 * @param collection the name of the collection
 * @param config the parser configuration for this folder (pattern, etc...)
 * @param callback when done
 */
const processFolder = (root, collection, config, callback) => {
  console.log('Will process folder ' + root);
  let fileCount = 0;
  let children = 0;
  let songs = [];
  ioUtils.readdir(root)
      .then((files) => {
        files.forEach((f) => {
          ioUtils.stat(root + '/' + f)
              .then((stats) => {
                if (stats.isFile() && f.toLowerCase().endsWith('.cdg')) {
                  // Found karaoke file
                  ++fileCount;
                  workers(config, root, collection, f.substr(0, f.length - '.cdg'.length), (err, song) => {
                    if (!err) {
                      console.log('Processed song ' + JSON.stringify(song));
                      if (!song.isDuplicate) {
                        songs.push(song);
                      }
                    }
                    if (--fileCount == 0 && children == 0) {
                      callback(songs);
                    }
                  });
                } else if (stats.isFile() && f.toLowerCase().endsWith('.zip')) {
                  // Found zip file. Rename and move
                  ++fileCount;
                  workersZip(config, root, collection, f.substr(0, f.length - '.zip'.length), (err, song) => {
                    if (!err) {
                      console.log('Processed zip ' + JSON.stringify(song));
                      if (!song.isDuplicate) {
                        songs.push(song);
                      }
                    }
                    if (--fileCount == 0 && children == 0) {
                      callback(songs);
                    }
                  });
                } else if (stats.isDirectory()) {
                  console.log('Found subfolder ' + f);
                  ++children;
                  // Directory == new collection. Recursive call.
                  processFolder(path.join(root, f), collection + '__' + f, config, (songsOfChild) => {
                    console.log('Processed subfolder ' + collection);
                    songs = songs.concat(songsOfChild);
                    if (fileCount == 0 && --children == 0) {
                      callback(songs);
                    }
                  });
                }
              })
              .catch((err) => {
                console.log(err);
              });
        });
      })
      .catch((err) => {
        console.log(err);
      });
};


// Create output directories
ioUtils.mkdirp(path.join('output', 'duplicates'));
ioUtils.mkdirp(path.join('output', 'errors'));
ioUtils.mkdirp(path.join('output', 'processed'));
// Read inputs
readInputs();