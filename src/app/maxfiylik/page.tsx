import Link from "next/link";
import { brand } from "@/config/brand";
import { t } from "@/i18n/uz";

// Privacy policy in Uzbek (CLAUDE.md §14 S4). TODO(team): have a lawyer review before production.
export default function Privacy() {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-8 text-[16px] leading-[1.6] font-semibold">
      <Link href="/" className="font-extrabold">
        ← {brand.name}
      </Link>
      <h1 className="font-black text-[30px] font-bold">{t.privacy.title}</h1>
      <p>
        {brand.name} — 5–9-sinf o&apos;quvchilari uchun matematika ustozi. Biz bolalar ma&apos;lumotlarini juda ehtiyotkorlik bilan saqlaymiz va
        faqat o&apos;qitish uchun zarur bo&apos;lgan eng kam ma&apos;lumotni yig&apos;amiz.
      </p>
      <h2 className="font-black text-[22px]">Nimani saqlaymiz</h2>
      <ul>
        <li>Taxallus (haqiqiy ism shart emas) va sinf.</li>
        <li>Tasodifiy anonim identifikator (cookie) — telefon raqami, elektron pochta yoki surat so&apos;ralmaydi.</li>
        <li>Javoblaringiz va har bir mavzu bo&apos;yicha o&apos;zlashtirish darajasi — yo&apos;l xaritasini tuzish uchun.</li>
      </ul>
      <h2 className="font-black text-[22px]">Ovoz</h2>
      <p>
        Mikrofon faqat tugmani bosib turganingizda yoziladi. Ovoz matnga aylantiriladi va <b>darhol o&apos;chiriladi</b> — biz ovozli yozuvlarni
        saqlamaymiz.
      </p>
      <h2 className="font-black text-[22px]">Nimani qilmaymiz</h2>
      <ul>
        <li>Reklama ko&apos;rsatmaymiz va bolalarni kuzatuvchi (tracking) vositalardan foydalanmaymiz.</li>
        <li>Ma&apos;lumotlarni sotmaymiz va uchinchi shaxslarga bermaymiz.</li>
      </ul>
      <h2 className="font-black text-[22px]">Ota-onalar roziligi</h2>
      <p>16 yoshgacha bo&apos;lgan bolalar xizmatdan ota-onasi (yoki qonuniy vakili) roziligi bilan foydalanadi.</p>
      <h2 className="font-black text-[22px]">Ma&apos;lumotlar qayerda saqlanadi</h2>
      <p>
        Sinov (hakaton) versiyasida ma&apos;lumotlar bulutli serverda saqlanadi. Ishlab chiqarish versiyasida O&apos;zbekiston fuqarolarining shaxsiy
        ma&apos;lumotlari qonunchilikka muvofiq O&apos;zbekiston hududidagi serverlarda saqlanadi.
      </p>
      <h2 className="font-black text-[22px]">Ma&apos;lumotlarni o&apos;chirish</h2>
      <p>
        Profil sahifasidagi &laquo;{t.profile.reset}&raquo; tugmasi barcha ma&apos;lumotlaringizni butunlay o&apos;chiradi.
      </p>
    </main>
  );
}
