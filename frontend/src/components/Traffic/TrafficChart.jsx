import { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Tooltip, Legend } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Tooltip, Legend);

export default function TrafficChart({ history }){
  const canvasRef = useRef(null);
  const summaryRef = useRef({ text: '', clearText: '' });
  useEffect(()=>{
    if(!canvasRef.current) return;
    if(!history || history.length===0) return;
    const ctx = canvasRef.current.getContext('2d');
    // Compute forecast using last two densities
    const labels = history.map(h=> new Date(h.timestamp).toLocaleTimeString());
    const densities = history.map(h=> h.density);
    const forecast = [];
    if(densities.length >= 2){
      const last = densities[densities.length-1];
      const prev = densities[densities.length-2];
      const trend = last - prev;
      for(let i=1;i<=5;i++){
        forecast.push(last + trend * 0.5 * i);
      }
      // Build summary like: Forecast (15m): X — Level (Low/Med/High confidence), Time to clear: N min when <=20
      const lastForecast = forecast[2] ?? forecast[forecast.length-1];
      const level = lastForecast < 20 ? 'Smooth' : (lastForecast < 50 ? 'Moderate' : 'Heavy');
      const confidence = Math.min(1, Math.abs(trend)/(Math.abs(last) || 1));
      // estimate minutes to clear (<=20) assuming same trend persists with 0.5 factor each step (3 min step baseline)
      let clearText = 'Unknown';
      if(trend < 0){
        const step = Math.abs(trend*0.5);
        if(step > 0){
          const stepsNeeded = Math.max(0, Math.ceil((last - 20) / step));
          const minutes = stepsNeeded * 3; // if each step ~ 3 minutes (tunable)
          if(last > 20) clearText = `${minutes} min`;
          else clearText = 'Already clear';
        }
      }
      summaryRef.current = {
        text: `Forecast (15m): ${Math.round(lastForecast)} — ${level} (${confidence < 0.33 ? 'Low' : confidence < 0.66 ? 'Medium' : 'High'} confidence)`,
        clear: `Time to clear (<=20): ${clearText}`
      };
    }
    const allLabels = [...labels, ...forecast.map((_,i)=>`+${i+1}m`)];
    const existing = Chart.getChart(canvasRef.current);
    if(existing) existing.destroy();
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          { label: 'Density', data: [...densities, ...Array(forecast.length).fill(null)], borderColor: '#2563eb', tension: 0.25 },
          { label: 'Forecast', data: [...Array(densities.length).fill(null), ...forecast], borderColor: '#f97316', borderDash: [4,4], tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } }
      }
    });
    return ()=> chart.destroy();
  },[history]);
  return <div>
    <canvas ref={canvasRef} className="w-full h-64" />
    {summaryRef.current?.text && <div className="text-xs mt-2">
      <p><strong>{summaryRef.current.text}</strong></p>
      <p>{summaryRef.current.clear}</p>
    </div>}
  </div>;
}
