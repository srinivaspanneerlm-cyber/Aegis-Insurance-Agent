import { Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import type { LocalisedText } from "@/types/documents";
import type { ContactChannel } from "@/services/api";

/**
 * "Help me renew" — the choices, and the words somebody agrees to.
 *
 * The consent wording here mirrors the API's `CONSENT_TEXT`, and mirrors it
 * *deliberately* rather than fetching it: a consent screen that renders a
 * sentence the server sent is one where a network hiccup shows an empty
 * agreement, and an empty agreement that somebody ticks is worse than no screen
 * at all. A test reads the backend file and fails if the two drift, which is the
 * failure mode that actually matters — the record stores the server's wording,
 * so a silent divergence would mean people agreeing to one thing and being
 * recorded as agreeing to another.
 */

export interface ChannelChoice {
  readonly id: ContactChannel;
  readonly label: LocalisedText;
  /** What actually happens if they pick this. Not a restatement of the label. */
  readonly detail: LocalisedText;
  readonly icon: LucideIcon;
  /** Whether choosing it means we need a number. */
  readonly needsPhone: boolean;
}

export const CHANNEL_CHOICES: readonly ChannelChoice[] = [
  {
    id: "CALL",
    label: { en: "Phone call", ta: "தொலைபேசி அழைப்பு", taEn: "Phone call" },
    detail: {
      en: "Someone rings you and talks it through.",
      ta: "ஒருவர் உங்களை அழைத்துப் பேசுவார்.",
      taEn: "Oruthar ungalukku call panni pesuvaanga.",
    },
    icon: Phone,
    needsPhone: true,
  },
  {
    id: "WHATSAPP",
    label: { en: "WhatsApp", ta: "வாட்ச்அப்", taEn: "WhatsApp" },
    detail: {
      en: "A person messages you. Nothing is sent automatically.",
      ta: "ஒருவர் உங்களுக்குச் செய்தி அனுப்புவார். தானாக எதுவும் அனுப்பப்படாது.",
      taEn: "Oruthar message panuvaanga. Thaana onnum anuppapadaadhu.",
    },
    icon: MessageCircle,
    needsPhone: true,
  },
  {
    id: "EMAIL",
    label: { en: "Email", ta: "மின்னஞ்சல்", taEn: "Email" },
    detail: {
      en: "We write to the address on your account.",
      ta: "உங்கள் கணக்கில் உள்ள முகவரிக்கு எழுதுவோம்.",
      taEn: "Ungal account-la irukka address-ku ezhudhurom.",
    },
    icon: Mail,
    needsPhone: false,
  },
];

export const channelChoice = (id: ContactChannel | "" | null): ChannelChoice | undefined =>
  CHANNEL_CHOICES.find((choice) => choice.id === id);

export const channelNeedsPhone = (id: ContactChannel | "" | null): boolean =>
  channelChoice(id)?.needsPhone ?? false;

/**
 * The agreement itself, word for word as the API stores it.
 *
 * Keep in step with `backend/src/consumer/messages.ts`. A test pins them
 * together; if it fails after a wording change, the version there has to be
 * bumped too, because every consent already on file refers to the old one.
 */
export const CONSENT_TEXT: Record<"RENEWAL_ASSISTANCE" | "RENEWAL_REMINDER", LocalisedText> = {
  RENEWAL_ASSISTANCE: {
    en: "I would like someone from Aegis to contact me about renewing this policy, using the way I have chosen above. Aegis is not an insurer and will not take any payment from me here. I can ask them to stop at any time, and my policy details stay exactly as I entered them.",
    ta: "இந்தப் பாலிசியைப் புதுப்பிப்பது குறித்து, நான் மேலே தேர்ந்தெடுத்த வழியில் ஏஜிஸ் நிறுவனத்திலிருந்து ஒருவர் என்னைத் தொடர்பு கொள்ள விரும்புகிறேன். ஏஜிஸ் ஒரு காப்பீட்டு நிறுவனம் அல்ல, இங்கு என்னிடமிருந்து எந்தப் பணமும் பெறாது. எப்போது வேண்டுமானாலும் நிறுத்தச் சொல்லலாம்; என் பாலிசி விவரங்கள் நான் பதிவு செய்தபடியே இருக்கும்.",
    taEn: "Indha policy renew panradhu pathi, naan mela select panna vazhiyila Aegis-la irundhu oruthar ennai contact panna virumbaren. Aegis oru insurance company illa, inga en kitta irundhu edhuvum panam vaangaadhu. Eppo venumnaalum niruthha sollalaam; en policy details naan podadhu padiye irukkum.",
  },
  RENEWAL_REMINDER: {
    en: "I would also like Aegis to remind me when this policy is coming up for renewal in future. This is a separate choice from the one above, and I can stop the reminders without stopping anything else.",
    ta: "எதிர்காலத்தில் இந்தப் பாலிசி புதுப்பிப்புக்கு வரும்போது ஏஜிஸ் எனக்கு நினைவூட்ட வேண்டும் என்றும் விரும்புகிறேன். இது மேலே உள்ளதிலிருந்து தனிப்பட்ட தேர்வு; மற்றவற்றை நிறுத்தாமல் இந்த நினைவூட்டல்களை மட்டும் நிறுத்த முடியும்.",
    taEn: "Adhukku appuram indha policy renewal-ku varumbodhu Aegis enakku nyaabagapaduthanum-nu-um virumbaren. Idhu mela irukkuradhu-la irundhu thani choice; matthadhu edhaiyum niruthhaama indha reminder-a mattum niruthhalaam.",
  },
};

/** Shown on the same screen as the agreement, never behind a link. */
export const CONSENT_EXPLAINER: LocalisedText = {
  en: "Nothing is sent automatically. A person at Aegis reads your request and gets in touch the way you asked. We do not message you on WhatsApp automatically, and we never share your details with a partner without telling you first.",
  ta: "எதுவும் தானாக அனுப்பப்படாது. ஏஜிஸில் ஒருவர் உங்கள் கோரிக்கையைப் படித்து, நீங்கள் கேட்ட வழியில் தொடர்பு கொள்வார். வாட்ச்அப்பில் தானாகச் செய்திகள் அனுப்ப மாட்டோம்; உங்களிடம் சொல்லாமல் உங்கள் விவரங்களைப் பங்குதாரருடன் பகிர மாட்டோம்.",
  taEn: "Edhuvum thaana anuppapadaadhu. Aegis-la oruthar ungal request-a padichu, neenga kettha vazhiyila contact panuvaanga. WhatsApp-la thaana message anuppa maatom; ungakitta sollaama ungal details-a partner-kitta share panna maatom.",
};

/**
 * How far a request has got, in words.
 *
 * The API already sends `statusLabel`, and that is what a screen renders. These
 * are the *explanations* beside it: a customer who reads "Partner handoff" has
 * been told a word from an operations vocabulary and nothing about what is
 * happening to them.
 */
export const REQUEST_STATUS_EXPLAINER: Record<string, LocalisedText> = {
  NEW: {
    en: "Your request is with us. Someone will pick it up.",
    ta: "உங்கள் கோரிக்கை எங்களிடம் உள்ளது. ஒருவர் அதை எடுத்துக்கொள்வார்.",
    taEn: "Ungal request engakitta irukku. Oruthar edupaanga.",
  },
  CONTACTED: {
    en: "Someone has been in touch with you about this.",
    ta: "இது குறித்து ஒருவர் உங்களைத் தொடர்பு கொண்டுள்ளார்.",
    taEn: "Idha pathi oruthar ungala contact pannitaanga.",
  },
  QUOTE_REQUESTED: {
    en: "We have asked a partner for a price for you.",
    ta: "உங்களுக்கான விலையைப் பங்குதாரரிடம் கேட்டுள்ளோம்.",
    taEn: "Ungalukku oru price kekka partner-kitta kettirukkom.",
  },
  PARTNER_HANDOFF: {
    en: "A partner is handling your renewal from here. They issue the policy, not us.",
    ta: "இங்கிருந்து பங்குதாரர் உங்கள் புதுப்பிப்பைக் கவனிப்பார். பாலிசியை அவர்கள் வழங்குவார்கள், நாங்கள் அல்ல.",
    taEn: "Inga irundhu partner ungal renewal-a paathukuvaanga. Policy avanga thaan issue panuvaanga, naanga illa.",
  },
  CLOSED: {
    en: "This request is finished.",
    ta: "இந்தக் கோரிக்கை முடிந்தது.",
    taEn: "Indha request mudinjiduchu.",
  },
};

/** The tone a request's status is drawn in. Never the only signal — see the badge. */
export const REQUEST_STATUS_TONE: Record<string, "neutral" | "active" | "settled"> = {
  NEW: "neutral",
  CONTACTED: "active",
  QUOTE_REQUESTED: "active",
  PARTNER_HANDOFF: "active",
  CLOSED: "settled",
};
