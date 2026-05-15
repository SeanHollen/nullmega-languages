import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LanguageBanner } from "./components/LanguageBanner";
import { HomePage } from "./pages/HomePage";
import { ReadingPage } from "./pages/ReadingPage";
import { ListeningPage } from "./pages/ListeningPage";
import { PronunciationPage } from "./pages/PronunciationPage";
import { WritingPage } from "./pages/WritingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GoalsPage } from "./pages/GoalsPage";
import { StatsPage } from "./pages/StatsPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { StudyPage } from "./pages/StudyPage";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <LanguageBanner />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/reading" element={<ReadingPage />} />
            <Route path="/listening" element={<ListeningPage />} />
            <Route path="/pronunciation" element={<PronunciationPage />} />
            <Route path="/writing" element={<WritingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/stats/:mode" element={<StatsPage />} />
            <Route path="/vocabulary" element={<VocabularyPage />} />
            <Route path="/vocabulary/:mode" element={<StudyPage />} />
          </Routes>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
