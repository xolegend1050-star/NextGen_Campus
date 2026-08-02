import { useMemo } from 'react';

const rules = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character (!@#$...)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const strengthLevels = [
  { label: 'Very Weak', color: 'bg-red-500', textColor: 'text-red-600', min: 0 },
  { label: 'Weak', color: 'bg-orange-500', textColor: 'text-orange-600', min: 1 },
  { label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-600', min: 2 },
  { label: 'Strong', color: 'bg-blue-500', textColor: 'text-blue-600', min: 3 },
  { label: 'Very Strong', color: 'bg-green-500', textColor: 'text-green-600', min: 5 },
];

function getStrength(password) {
  if (!password) return { level: null, score: 0, passed: 0 };
  const passed = rules.filter((r) => r.test(password)).length;
  const level = [...strengthLevels].reverse().find((l) => passed >= l.min);
  return { level, score: (passed / rules.length) * 100, passed };
}

export default function PasswordStrength({ password }) {
  const { level, score, passed } = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${level?.color || 'bg-gray-200'}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-medium min-w-[80px] text-right ${level?.textColor || 'text-gray-400'}`}>
          {level?.label || ''}
        </span>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 gap-1">
        {rules.map((rule) => {
          const passed_rule = rule.test(password);
          return (
            <div key={rule.id} className="flex items-center gap-1.5">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  passed_rule
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {passed_rule ? '\u2713' : '\u00d7'}
              </span>
              <span className={`text-xs ${passed_rule ? 'text-green-600' : 'text-gray-500'}`}>
                {rule.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
