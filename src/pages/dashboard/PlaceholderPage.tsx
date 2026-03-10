import { useLanguage } from "@/contexts/LanguageContext";

interface PlaceholderPageProps {
  titleKey: string;
}

const PlaceholderPage = ({ titleKey }: PlaceholderPageProps) => {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="font-heading text-2xl font-bold text-foreground mb-4">
        {t(titleKey)}
      </h2>
      <div className="border border-border p-8">
        <p className="font-body text-sm text-muted-foreground text-center">
          Coming soon...
        </p>
      </div>
    </div>
  );
};

export default PlaceholderPage;
