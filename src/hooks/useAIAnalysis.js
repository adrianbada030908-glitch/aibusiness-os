import { useAppContext } from '../context/AppContext';

export const useAIAnalysis = () => {
  const { setAnalysisData, setLoading } = useAppContext();

  const analyze = async (prompt) => {
    setLoading(true);
    try {
      // Simulación de llamada a la API
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockResult = { nicho: "SaaS para Fitness", score: 95 };
      setAnalysisData(mockResult);
      return mockResult;
    } catch (error) {
      console.error("Error analizando:", error);
    } finally {
      setLoading(false);
    }
  };

  return { analyze };
};
