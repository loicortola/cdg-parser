const fs = require('fs');
const path = require('path');
const Promise = require("bluebird");

const mkdirp = Promise.promisify(require('mkdirp'));
const readdir = Promise.promisify(fs.readdir);
const readFile = Promise.promisify(fs.readFile);
const stat = Promise.promisify(fs.stat);
const access = Promise.promisify(fs.access);

const workerFarm = require('worker-farm');
const workers  = workerFarm(require.resolve('./process-song'));

/**
 * Read all inputs
 */
const readInputs = () => {
  let allSongs = [];
  readdir('./input')
    .then((files) => {
      files.forEach((f) => {
        const karaokeRoot = './input/' + f;
        const parserFile = karaokeRoot + '/parser.json';
        access(parserFile, fs.constants.F_OK)
          .then(() => {
            // File parser.js exists, we are in an official karaoke directory.
            console.log('Parser file found: ' + parserFile);
            let folderCount = 0;
            readFile(parserFile, {encoding: 'utf8'})
              .then((data) => {
                folderCount++;
                processFolder(karaokeRoot, f, JSON.parse(data), (songs) => {
                  console.log('Finished processing folder');
                  allSongs = allSongs.concat(songs);
                  --folderCount;
                  if (folderCount == 0) {
                    workerFarm.end(workers);
                    createId(allSongs);
                    createSongIndexByArtist(allSongs);
                    createSongIndexByTitle(allSongs);
                    saveIndex(allSongs);
                  }
                });
              })
              .catch((err) => {
                console.log(err);
              });
          })
          .catch((err) => {
            console.error(err);
          });
      });
    })
    .catch((err) => {
      console.log(err);
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
  readdir(root)
      .then((files) => {
        files.forEach((f) => {
          stat(root + '/' + f)
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

const createId = (songs) => {
  let i = 1;
  songs.forEach((s) => {
    s.id = i++;
  });
};

const createSongIndexByArtist = (songs) => {
  songs.sort((a, b) => {
    if (a.artist === b.artist) {
      return a.title > b.title ? 1 : -1;
    }
    return a.artist > b.artist ? 1 : -1;
  });
  let index = fs.createWriteStream(path.join('output', 'index-by-artist.csv'), {
    flags: 'w'
  });
  let previousArtist = null;
  songs.forEach((s) => {
    if (s.artist !== previousArtist) {
      previousArtist = s.artist;
      index.write('------' + s.artist.toUpperCase() + '------\r\n');
    }
    index.write(pad(s.id) + ' - ' + s.title + '\r\n');
  });
  index.end()
};

const createSongIndexByTitle = (songs) => {
  songs.sort((a, b) => {
    if (a.title === b.title ) {
      return a.artist > b.artist ? 1 : -1;
    }
    return a.title > b.title ? 1 : -1;
  });
  const index = fs.createWriteStream(path.join('output', 'index-by-title.csv'), {
    flags: 'w'
  });
  songs.forEach((s) => {
    index.write(pad(s.id) + ' - ' + s.title + ' -- ' + s.artist + '\r\n');
  });
  index.end()
};

const saveIndex = (songs) => {
  const index = fs.createWriteStream(path.join('output', 'index.json'), {
    flags: 'w'
  });
  index.write(JSON.stringify(songs));
  index.end();
};

const pad = (n, z) => {
  const width = 6;
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

// Create output directories
mkdirp(path.join('output', 'duplicates'));
mkdirp(path.join('output', 'errors'));
mkdirp(path.join('output', 'processed'));

readInputs();