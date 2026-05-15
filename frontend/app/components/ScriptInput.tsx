"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ScriptInput({ value, onChange }: Props) {
  const charCount = value.length;
  const estimatedTotal = Math.round(charCount / 5.5);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-gray-700">대본 입력</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="유튜브 영상 대본을 여기에 붙여넣으세요..."
        rows={12}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-300"
      />
      {charCount > 0 && (
        <div className="flex gap-4 text-xs text-gray-400">
          <span>{charCount.toLocaleString()}자</span>
          <span>예상 낭독 시간: 약 {Math.floor(estimatedTotal / 60)}분 {estimatedTotal % 60}초</span>
        </div>
      )}
    </div>
  );
}
