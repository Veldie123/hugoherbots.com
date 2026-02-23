import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { ChevronLeft, Shield, Lock, Eye, FileText, Users, Clock, Mail } from "lucide-react";

interface PrivacyPolicyProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

export function PrivacyPolicy({ navigate, isAdmin }: PrivacyPolicyProps) {
  return (
    <AppLayout currentPage="privacy" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <button
            onClick={() => navigate?.("analysis")}
            className="flex items-center gap-1.5 text-hh-muted hover:text-hh-text mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-[14px]">Terug</span>
          </button>
          <h1 className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] font-semibold text-hh-text mb-2">
            Privacy Beleid
          </h1>
          <p className="text-[14px] leading-[22px] text-hh-muted">
            Laatst bijgewerkt: januari 2025
          </p>
        </div>

        <Card className="p-6 rounded-[16px] border-hh-border space-y-6">
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-hh-primary" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                1. Inleiding
              </h2>
            </div>
            <p className="text-[14px] leading-[24px] text-hh-muted">
              HugoHerbots.ai ("wij", "ons", "onze") respecteert uw privacy en zet zich in voor de bescherming 
              van uw persoonsgegevens. Dit privacybeleid beschrijft hoe wij omgaan met informatie die via ons 
              AI sales coaching platform wordt verzameld, inclusief audio- en video-opnames van 
              verkoopgesprekken.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                2. Gegevens die wij verzamelen
              </h2>
            </div>
            <div className="text-[14px] leading-[24px] text-hh-muted space-y-3">
              <p><strong className="text-hh-text">Accountgegevens:</strong> naam, e-mailadres, bedrijfsinformatie.</p>
              <p><strong className="text-hh-text">Gesprekopnames:</strong> audio- en video-bestanden die u uploadt voor analyse.</p>
              <p><strong className="text-hh-text">Transcripties:</strong> automatisch gegenereerde tekstversies van uw gesprekken.</p>
              <p><strong className="text-hh-text">Gebruiksgegevens:</strong> interacties met het platform, voortgang, en leerprestaties.</p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                3. Hoe wij gegevens gebruiken
              </h2>
            </div>
            <div className="text-[14px] leading-[24px] text-hh-muted space-y-3">
              <p>Wij gebruiken uw gegevens uitsluitend voor:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Het leveren van AI-gestuurde analyse en coaching feedback</li>
                <li>Het verbeteren van uw verkoopvaardigheden via gepersonaliseerde aanbevelingen</li>
                <li>Het genereren van voortgangsrapporten en prestatie-inzichten</li>
                <li>Het verbeteren van onze diensten en AI-modellen (geanonimiseerd)</li>
              </ul>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-hh-primary" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                4. Toestemming van derden
              </h2>
            </div>
            <div className="text-[14px] leading-[24px] text-hh-muted space-y-3 bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="font-semibold text-amber-800">Belangrijk:</p>
              <p>
                U bent verantwoordelijk voor het verkrijgen van expliciete toestemming van alle personen 
                die in uw opnames voorkomen. Bij echte klantgesprekken:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Informeer de klant vooraf dat het gesprek wordt opgenomen</li>
                <li>Leg uit dat de opname wordt gebruikt voor training en analyse</li>
                <li>Verkrijg mondelinge of schriftelijke toestemming</li>
                <li>Bied altijd de mogelijkheid om opname te weigeren</li>
              </ul>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-teal-600" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                5. Beveiliging
              </h2>
            </div>
            <div className="text-[14px] leading-[24px] text-hh-muted space-y-3">
              <p>Wij beschermen uw gegevens met:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>End-to-end versleuteling voor alle opnames</li>
                <li>Veilige opslag op ISO 27001-gecertificeerde servers</li>
                <li>Strikte toegangscontroles en authenticatie</li>
                <li>Regelmatige beveiligingsaudits en penetratietests</li>
              </ul>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                6. Bewaartermijn
              </h2>
            </div>
            <p className="text-[14px] leading-[24px] text-hh-muted">
              Opnames en transcripties worden bewaard zolang uw account actief is. U kunt op elk moment 
              verzoeken om specifieke opnames te verwijderen. Na beëindiging van uw account worden alle 
              persoonsgegevens binnen 30 dagen permanent verwijderd.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-600" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                7. Uw rechten
              </h2>
            </div>
            <div className="text-[14px] leading-[24px] text-hh-muted space-y-3">
              <p>Onder de AVG/GDPR heeft u recht op:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-hh-text">Inzage:</strong> bekijk welke gegevens wij over u bewaren</li>
                <li><strong className="text-hh-text">Correctie:</strong> laat onjuiste gegevens aanpassen</li>
                <li><strong className="text-hh-text">Verwijdering:</strong> vraag verwijdering van uw gegevens aan</li>
                <li><strong className="text-hh-text">Overdraagbaarheid:</strong> ontvang uw gegevens in een gangbaar formaat</li>
                <li><strong className="text-hh-text">Bezwaar:</strong> maak bezwaar tegen bepaalde verwerkingen</li>
              </ul>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-hh-primary" />
              </div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
                8. Contact
              </h2>
            </div>
            <p className="text-[14px] leading-[24px] text-hh-muted">
              Voor vragen over dit privacybeleid of om uw rechten uit te oefenen, neem contact met ons op 
              via <a href="mailto:privacy@hugoherbots.ai" className="text-hh-primary hover:underline">privacy@hugoherbots.ai</a>.
            </p>
          </section>
        </Card>

        <p className="text-[12px] leading-[18px] text-hh-muted text-center">
          © {new Date().getFullYear()} HugoHerbots.ai. Alle rechten voorbehouden.
        </p>
      </div>
    </AppLayout>
  );
}
