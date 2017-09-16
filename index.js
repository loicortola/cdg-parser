const fs = require('fs');
const path = require('path');

const ioUtils = require('./lib/io-utils');
const indexUtils = require('./lib/index-utils');

const workerFarm = require('worker-farm');
const workers = workerFarm(require.resolve('./lib/process-song'));
const workersZip = workerFarm(require.resolve('./lib/process-zip'));

const Song = require('./lib/song');

const inputDir = 'input';
const outputDir = 'output';

/**
 * Write songs in a file when done
 * @param songs
 */
const finish = (config, songs) => {
  // Kill farms
  workerFarm.end(workers);
  workerFarm.end(workersZip);
  // Create indexes
  
  try {
    fs.statSync(path.join(config.outputDir, 'index.json'));
    console.log('Had one previous index. Merging');
    const previousIndex = indexUtils.loadPreviousIndex(config.outputDir);
    songs = songs.concat(previousIndex);
  } catch (err) {}
  indexUtils.createSongIndexByArtist(config.outputDir, songs);
  indexUtils.createSongIndexByTitle(config.outputDir, songs);
  indexUtils.saveIndex(config.outputDir, songs);
};

const setNextSongId = () => {
  try {
    fs.statSync(path.join(outputDir, 'index.json'));
    console.log('Had one previous index. Setting song id to latest id');
    let nextSongId = 0;
    indexUtils.loadPreviousIndex(outputDir).forEach((s) => {
      if (s.id > nextSongId) {
        nextSongId = s.id;
      }
    });
    Song.nextId = ++nextSongId;
  } catch (err) {}
};

/**
 * Read all inputs
 */
const readInputs = () => {
  let allSongs = [];
  let folderCount = 0;
  setNextSongId();
  console.log('Will read input');
  ioUtils.readdir(path.join(inputDir))
      .then((files) => {
        console.log('Found ' + files.length + ' folders');
        files.forEach((f) => {
          const karaokeRoot = path.join(inputDir, f);
          const parserFile = path.join(karaokeRoot, 'parser.json');
          ioUtils.access(parserFile, fs.constants.F_OK)
              .then(() => {
                // File parser.js exists, we are in an official karaoke directory.
                console.log('Parser file found: ' + parserFile);
                ioUtils.readFile(parserFile, {encoding: 'utf8'})
                    .then((data) => {
                      console.log('Started processing folder ' + f);
                      folderCount++;
                      const config = JSON.parse(data);
                      config.inputDir = inputDir;
                      config.outputDir = outputDir;
                      processFolder(karaokeRoot, f, config, (songs) => {
                        console.log('Finished processing folder ' + f);
                        console.log('There are ' + folderCount + ' left');
                        allSongs = allSongs.concat(songs);
                        --folderCount;
                        if (folderCount == 0) {
                          finish(config, allSongs);
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
          ioUtils.stat(path.join(root, f))
              .then((stats) => {
                if (stats.isFile() && f.toLowerCase().endsWith('.cdg')) {
                  // Found karaoke file
                  ++fileCount;
                  workers(config, root, collection, f.substr(0, f.length - '.cdg'.length), Song.nextId++, (err, song) => {
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
                  workersZip(config, root, collection, f.substr(0, f.length - '.zip'.length), Song.nextId++, (err, song) => {
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
ioUtils.mkdirp(path.join(outputDir, 'duplicates'));
ioUtils.mkdirp(path.join(outputDir, 'errors'));
ioUtils.mkdirp(path.join(outputDir, 'processed'));
// Read inputs
readInputs();