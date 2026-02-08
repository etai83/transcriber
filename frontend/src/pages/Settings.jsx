import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const [diarizationEnabled, setDiarizationEnabled] = useState(
    localStorage.getItem('diarization_enabled') === 'true'
  );
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(
    localStorage.getItem('input_device_id') || ''
  );
  const [deviceLabel, setDeviceLabel] = useState('Default');

  useEffect(() => {
    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }); // Request permission
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setInputDevices(audioInputs);

        const currentDevice = audioInputs.find(d => d.deviceId === selectedDeviceId);
        if (currentDevice) {
            setDeviceLabel(currentDevice.label);
        } else if (audioInputs.length > 0) {
            setDeviceLabel(audioInputs[0].label);
            if (!selectedDeviceId) {
                setSelectedDeviceId(audioInputs[0].deviceId);
                localStorage.setItem('input_device_id', audioInputs[0].deviceId);
            }
        }
      } catch (err) {
        console.error("Error loading devices", err);
        setDeviceLabel("Permission required");
      }
    }
    loadDevices();
  }, [selectedDeviceId]);

  const toggleDiarization = () => {
    const newVal = !diarizationEnabled;
    setDiarizationEnabled(newVal);
    localStorage.setItem('diarization_enabled', newVal);
  };

  const handleDeviceChange = (e) => {
    const deviceId = e.target.value;
    setSelectedDeviceId(deviceId);
    localStorage.setItem('input_device_id', deviceId);
    const device = inputDevices.find(d => d.deviceId === deviceId);
    if (device) setDeviceLabel(device.label);
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto border-x border-slate-800 shadow-2xl bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-background-dark/95 backdrop-blur-md px-4 py-3 border-b border-slate-800 text-white">
        <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-800 transition-colors text-white">
          <span className="material-symbols-outlined text-[28px]">arrow_back</span>
        </Link>
        <h1 className="text-lg font-bold tracking-tight">Settings</h1>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-6 p-4 pb-12">
        {/* Transcription Section */}
        <section>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">Transcription</h3>
          <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
            {/* Item: Whisper Model */}
            <div className="flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full group cursor-pointer">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500">
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-sm font-medium">Whisper Model</span>
                  <span className="text-slate-500 text-xs">Accuracy vs Speed</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Large-v2</span>
                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
              </div>
            </div>

            {/* Item: Speaker Diarization (Toggle) */}
            <div className="flex items-center justify-between p-4 bg-surface-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500">
                  <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-sm font-medium">Speaker Diarization</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={diarizationEnabled}
                  onChange={toggleDiarization}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Audio Section */}
        <section>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">Audio</h3>
          <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
            {/* Item: Input Device */}
            <div className="relative flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full">
              <div className="flex items-center gap-3 text-left pointer-events-none">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </div>
                <span className="text-white text-sm font-medium">Input Device</span>
              </div>
              <div className="flex items-center gap-2 pointer-events-none">
                <span className="text-slate-400 text-sm max-w-[120px] truncate">{deviceLabel}</span>
                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
              </div>
              <select
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={selectedDeviceId}
                onChange={handleDeviceChange}
              >
                {inputDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Local Storage Section */}
        <section>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">Local Storage</h3>
          <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
            <button className="flex items-center justify-center p-4 hover:bg-surface-highlight transition-colors w-full border-t border-slate-800">
              <span className="text-red-500 text-sm font-semibold">Clear Cache</span>
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-slate-600 text-xs">Version 1.0.2</p>
        </div>
      </main>
    </div>
  );
}
