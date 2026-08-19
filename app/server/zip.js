import fs from "node:fs";
import zlib from "node:zlib";

export class ZipReader {
  constructor(filePath) {
    this.fd = fs.openSync(filePath, "r");
    this.size = fs.fstatSync(this.fd).size;
    this.entries = new Map();
    this._index();
  }

  read(name) {
    const ent = this.entries.get(name);
    if (!ent) return null;
    const local = Buffer.alloc(30);
    fs.readSync(this.fd, local, 0, 30, ent.offset);
    const nameLen = local.readUInt16LE(26);
    const extraLen = local.readUInt16LE(28);
    const dataOff = ent.offset + 30 + nameLen + extraLen;
    const raw = Buffer.alloc(ent.comp);
    fs.readSync(this.fd, raw, 0, ent.comp, dataOff);
    if (ent.method === 0) return raw;
    if (ent.method === 8) return zlib.inflateRawSync(raw);
    throw new Error("unsupported zip method " + ent.method);
  }

  close() {
    fs.closeSync(this.fd);
  }

  _index() {
    const maxComment = 65535;
    const tailLen = Math.min(this.size, 22 + maxComment);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(this.fd, tail, 0, tailLen, this.size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("zip EOCD not found");
    const cdOff = tail.readUInt32LE(eocd + 16);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cd = Buffer.alloc(cdSize);
    fs.readSync(this.fd, cd, 0, cdSize, cdOff);
    let p = 0;
    while (p + 46 <= cd.length) {
      if (cd.readUInt32LE(p) !== 0x02014b50) break;
      const method = cd.readUInt16LE(p + 10);
      const comp = cd.readUInt32LE(p + 20);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const offset = cd.readUInt32LE(p + 42);
      const name = cd.toString("utf8", p + 46, p + 46 + nameLen).replace(/\\/g, "/");
      this.entries.set(name, { method, comp, offset });
      p += 46 + nameLen + extraLen + commentLen;
    }
  }
}
