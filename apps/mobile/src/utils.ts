const HEX = "0123456789abcdef";

export function generateId(): string {
  let id = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      id += "-";
    } else if (i === 14) {
      id += "4";
    } else if (i === 19) {
      id += HEX[(Math.random() * 4) | 8];
    } else {
      id += HEX[(Math.random() * 16) | 0];
    }
  }
  return id;
}
