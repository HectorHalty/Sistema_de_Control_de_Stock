import { useState } from 'react';
import { usePublicAuth } from './PublicAuthContext';
import { shouldShowOnboarding } from './auth-helpers';
import { JugadorDniStep } from './JugadorDniStep';
import { TeamPicker } from './TeamPicker';
import { useFutbolIdentity } from './useFutbolIdentity';

type Step = 'choose' | 'jugador' | 'hincha';

export function OnboardingGate() {
  const { user, onboardingDismissed, dismissOnboarding } = usePublicAuth();
  const { followTeam } = useFutbolIdentity();
  const [step, setStep] = useState<Step>('choose');

  if (!shouldShowOnboarding(user, onboardingDismissed)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-lch-card p-6">
        {step === 'choose' && (
          <>
            <h2 className="text-lg font-black text-white">¿Sos jugador o hincha?</h2>
            <p className="mt-1 text-sm text-gray-400">
              Elegí cómo querés usar la app. Podés cambiarlo después desde tu perfil.
            </p>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => setStep('jugador')}
                className="rounded-xl bg-lch-accent py-3 font-black text-[#0e0e0e]"
              >
                Soy jugador
              </button>
              <button
                type="button"
                onClick={() => setStep('hincha')}
                className="rounded-xl border border-[#2a2a2a] bg-[#161616] py-3 font-bold text-white"
              >
                Soy hincha
              </button>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-300"
            >
              Más tarde
            </button>
          </>
        )}

        {step === 'jugador' && (
          <>
            <button type="button" onClick={() => setStep('choose')} className="mb-3 text-xs text-gray-500">
              ← Volver
            </button>
            <h2 className="mb-3 text-lg font-black text-white">Confirmá tu DNI</h2>
            <JugadorDniStep onDone={dismissOnboarding} />
          </>
        )}

        {step === 'hincha' && (
          <>
            <button type="button" onClick={() => setStep('choose')} className="mb-3 text-xs text-gray-500">
              ← Volver
            </button>
            <h2 className="mb-3 text-lg font-black text-white">Elegí tu equipo</h2>
            <TeamPicker
              onPick={(id) => {
                followTeam(id);
                dismissOnboarding();
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
