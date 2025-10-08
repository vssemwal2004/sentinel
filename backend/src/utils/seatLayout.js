// Simple seat layout generator.
// Given totalSeats, produce an ordered array of seat identifiers.
// Strategy: 4 seats per row: A B  (aisle)  C D -> labels like 1A,1B,1C,1D
// If seats not divisible by 4, last row truncates from left to right.

export function generateSeatIds(totalSeats){
  const letters = ['A','B','C','D'];
  const seats = [];
  let count = 0; let row = 1;
  while(count < totalSeats){
    for(let i=0;i<4 && count < totalSeats;i++){
      seats.push(`${row}${letters[i]}`);
      count++;
    }
    row++;
  }
  return seats;
}

// Public shape helper for client (optional future extension)
export function buildSeatMap(totalSeats){
  const ids = generateSeatIds(totalSeats);
  // Group every 4 as a row
  const rows = [];
  for(let i=0;i<ids.length;i+=4){
    rows.push(ids.slice(i,i+4));
  }
  return { rows, flat: ids };
}
