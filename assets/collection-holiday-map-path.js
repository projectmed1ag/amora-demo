export const holidayMapPoints = {
  house: { label: 'Хаусботы', xy: [21, 69], route: [[21, 69], [29, 67], [37, 63], [39, 58]] },
  reception: { label: 'Ресепшен', xy: [37, 56], route: [[37, 56], [39, 58]] },
  restaurant: { label: 'Ресторан', xy: [59, 39], route: [[59, 39], [58, 42], [49, 47], [45, 57], [39, 58]] },
  banya: { label: 'Баня', xy: [85, 35], route: [[85, 35], [79, 37], [75, 41], [69, 42], [58, 42], [49, 47], [45, 57], [39, 58]] },
  rental: { label: 'Прокат', xy: [70, 62], route: [[70, 62], [63, 63], [56, 65], [50, 60], [45, 57], [39, 58]] },
  pier: { label: 'Причал', xy: [49, 78], route: [[49, 78], [50, 72], [53, 69], [56, 65], [50, 60], [45, 57], [39, 58]] },
};

export function drawHolidayMapPath(canvas, origin, destination) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  if (!destination || origin === destination) return;
  const from = [...holidayMapPoints[origin].route], to = [...holidayMapPoints[destination].route];
  while (from.length > 1 && to.length > 1 && from.at(-2).join() === to.at(-2).join()) {
    from.pop();
    to.pop();
  }
  const path = [...from, ...to.reverse().slice(1)];
  context.beginPath();
  path.forEach(([x, y], index) => context[index ? 'lineTo' : 'moveTo'](x * width / 100, y * height / 100));
  context.lineJoin = context.lineCap = 'round';
  context.strokeStyle = '#fff9e8';
  context.lineWidth = 12;
  context.stroke();
  context.strokeStyle = '#314b40';
  context.lineWidth = 6;
  context.setLineDash([13, 9]);
  context.stroke();
  context.setLineDash([]);
}
