class Song {

  constructor(id) {
    this.id = id || Song.nextId++;
    this.artist = null;
    this.title = null;
    this.tag = null;
  }

  getSongName() {
    return this.artist + ' -- ' + this.title + (this.tag ? ' [' + this.tag + ']' : '');
  }
}

Song.nextId = 1;

module.exports = Song;
