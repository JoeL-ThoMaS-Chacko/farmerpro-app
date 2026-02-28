import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, History, Trash2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Swipeable } from "react-native-gesture-handler";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface CropData {
  N: number | null;
  P: number | null;
  K: number | null;
  ph: number | null;
  temperature: number;
  humidity: number;
  rainfall: number;
}

interface TopPrediction {
  rank: number;
  crop: string;
  probability: number;
  confidence_percentage: number;
}

interface CropPrediction {
  crop: string;
  description: string;
  imageUrl: string;
  growing_season: string;
  water_requirements: string;
  soil_type: string;
  rank: number;
}

interface PredictionResult {
  predictions: CropPrediction[];
  timestamp: number;
  inputData?: CropData;
}

// Mean values for NPK when user doesn't provide them
const MEAN_VALUES = {
  N: 100,
  P: 40,
  K: 50,
};

// Crop information database
const CROP_INFO: {
  [key: string]: {
    description: string;
    imageUrl: string;
    season: string;
    water: string;
    soil: string;
  };
} = {
  rice: {
    description:
      "Rice thrives in warm, humid conditions with clayey soil that retains water well. Ideal for Kerala climate with monsoon irrigation.",
    imageUrl:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop",
    season: "June - October (Kharif)",
    water: "High (1200-2500 mm)",
    soil: "Clayey loam",
  },
  coconut: {
    description:
      "Coconut palms grow excellently in coastal regions with high humidity, well-drained sandy loam soil, and consistent rainfall throughout the year.",
    imageUrl:
      "https://images.unsplash.com/photo-1598534299099-e5f44d11d125?w=400&h=300&fit=crop",
    season: "Year-round",
    water: "Moderate (1000-1500 mm)",
    soil: "Sandy loam",
  },
  banana: {
    description:
      "Bananas require warm temperatures, high humidity, and rich, well-drained soil with plenty of organic matter for optimal growth.",
    imageUrl:
      "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop",
    season: "Year-round",
    water: "High (1200-2200 mm)",
    soil: "Rich loamy soil",
  },
  maize: {
    description:
      "Maize requires warm weather, fertile well-drained soil rich in organic matter, and adequate moisture during the growing period.",
    imageUrl:
      "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&h=300&fit=crop",
    season: "June - September (Kharif)",
    water: "Moderate (500-800 mm)",
    soil: "Sandy loam to clay loam",
  },
  cotton: {
    description:
      "Cotton requires warm climate, moderate rainfall, and black cotton soil. Needs at least 200 frost-free days for optimal growth.",
    imageUrl:
      "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&h=300&fit=crop",
    season: "April - October (Kharif)",
    water: "Moderate (600-1200 mm)",
    soil: "Black cotton soil",
  },
  blackgram: {
    description:
      "Black gram is a protein-rich pulse crop that grows well in warm climates. It requires well-drained loamy soil and moderate rainfall.",
    imageUrl:
      "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&h=300&fit=crop",
    season: "July - October (Kharif)",
    water: "Low to Moderate (400-600 mm)",
    soil: "Loamy to clay loam",
  },
  chickpea: {
    description:
      "Chickpea is a cool-season crop requiring moderate temperatures. It thrives in well-drained soils and is drought-tolerant.",
    imageUrl:
      "https://images.unsplash.com/photo-1610940280769-0938be9a77e9?w=400&h=300&fit=crop",
    season: "October - March (Rabi)",
    water: "Low (300-500 mm)",
    soil: "Well-drained loamy soil",
  },
  coffee: {
    description:
      "Coffee grows in tropical highlands with cool temperatures, high humidity, and rich volcanic soil. Requires shade and consistent rainfall.",
    imageUrl:
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=300&fit=crop",
    season: "Year-round",
    water: "High (1500-2500 mm)",
    soil: "Rich, well-drained volcanic soil",
  },
  jute: {
    description:
      "Jute is a fiber crop that requires warm, humid climate with heavy rainfall. It grows best in alluvial soil of river deltas.",
    imageUrl:
      "https://images.unsplash.com/photo-1597306691829-9c0b5b5c6b3e?w=400&h=300&fit=crop",
    season: "March - July (Kharif)",
    water: "High (1500-2000 mm)",
    soil: "Alluvial sandy loam",
  },
  kidneybeans: {
    description:
      "Kidney beans are nutritious legumes that prefer cool climates. They need well-drained soil and moderate water during growing season.",
    imageUrl:
      "https://images.unsplash.com/photo-1583523032162-e7f2b8b8c3f1?w=400&h=300&fit=crop",
    season: "June - October",
    water: "Moderate (500-700 mm)",
    soil: "Well-drained loamy soil",
  },
  lentil: {
    description:
      "Lentil is a cool-season pulse crop that requires moderate temperatures. It is drought-tolerant and grows in various soil types.",
    imageUrl:
      "https://images.unsplash.com/photo-1599909533005-b38f8825e0cd?w=400&h=300&fit=crop",
    season: "October - March (Rabi)",
    water: "Low to Moderate (300-500 mm)",
    soil: "Loamy to clay loam",
  },
  mango: {
    description:
      "Mango trees thrive in tropical and subtropical climates with distinct wet and dry seasons. Requires deep, well-drained soil.",
    imageUrl:
      "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=300&fit=crop",
    season: "Year-round (Fruiting: Feb-June)",
    water: "Moderate (700-1200 mm)",
    soil: "Deep, well-drained loamy soil",
  },
  mothbeans: {
    description:
      "Moth beans are drought-resistant legumes suitable for arid regions. They grow well in sandy soils with minimal water requirements.",
    imageUrl:
      "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&h=300&fit=crop",
    season: "July - October",
    water: "Very Low (300-400 mm)",
    soil: "Sandy loam",
  },
  mungbean: {
    description:
      "Mung beans are versatile legumes that grow in warm climates. They prefer well-drained soil and have short growing periods.",
    imageUrl:
      "https://images.unsplash.com/photo-1596797882870-8c33deeac224?w=400&h=300&fit=crop",
    season: "June - September (Kharif)",
    water: "Moderate (400-600 mm)",
    soil: "Well-drained sandy loam",
  },
  muskmelon: {
    description:
      "Muskmelon requires warm temperatures, plenty of sunshine, and well-drained sandy soil. It needs consistent moisture during fruit development.",
    imageUrl:
      "https://images.unsplash.com/photo-1563114773-84221bd62daa?w=400&h=300&fit=crop",
    season: "February - June (Summer)",
    water: "Moderate (400-600 mm)",
    soil: "Sandy loam",
  },
  orange: {
    description:
      "Orange trees thrive in subtropical climates with warm temperatures. They require well-drained soil and consistent moisture.",
    imageUrl:
      "https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=400&h=300&fit=crop",
    season: "Year-round",
    water: "Moderate (1000-1500 mm)",
    soil: "Well-drained sandy loam",
  },
  papaya: {
    description:
      "Papaya grows best in tropical climates with warm temperatures year-round. It requires well-drained, fertile soil rich in organic matter.",
    imageUrl:
      "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&h=300&fit=crop",
    season: "Year-round",
    water: "High (1200-1800 mm)",
    soil: "Well-drained loamy soil",
  },
  pigeonpeas: {
    description:
      "Pigeon peas are drought-tolerant legumes suitable for semi-arid regions. They improve soil fertility and grow in various soil types.",
    imageUrl:
      "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&h=300&fit=crop",
    season: "June - December (Kharif)",
    water: "Low to Moderate (500-700 mm)",
    soil: "Well-drained loamy soil",
  },
  pomegranate: {
    description:
      "Pomegranate grows in semi-arid climates with hot summers. It is drought-tolerant and prefers well-drained soil with good sunlight.",
    imageUrl:
      "https://images.unsplash.com/photo-1615485925763-4f08b4d96b0f?w=400&h=300&fit=crop",
    season: "Year-round (Fruiting: Sept-Feb)",
    water: "Low to Moderate (500-800 mm)",
    soil: "Well-drained sandy loam",
  },
  watermelon: {
    description:
      "Watermelon requires hot temperatures, plenty of sunshine, and sandy loam soil. It needs consistent moisture during growth and fruit development.",
    imageUrl:
      "https://images.unsplash.com/photo-1587049352846-4a222e784538?w=400&h=300&fit=crop",
    season: "February - June (Summer)",
    water: "Moderate (500-700 mm)",
    soil: "Sandy loam",
  },
};

const CropPredictionScreen: React.FC = () => {
  const params = useLocalSearchParams();

  const weatherData = {
    temperature: params.temperature ? Number(params.temperature) : 28,
    humidity: params.humidity ? Number(params.humidity) : 75,
    rainfall: params.rainfall ? Number(params.rainfall) : 2500,
    district: params.district || "Unknown",
  };

  const [formData, setFormData] = useState<CropData>({
    N: null,
    P: null,
    K: null,
    ph: null,
    temperature: weatherData.temperature,
    humidity: weatherData.humidity,
    rainfall: weatherData.rainfall,
  });

  const [predictionResult, setPredictionResult] =
    useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem("cropPredictionHistory");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const saveToHistory = async (newPrediction: PredictionResult) => {
    try {
      const updatedHistory = [newPrediction, ...history];
      await AsyncStorage.setItem(
        "cropPredictionHistory",
        JSON.stringify(updatedHistory),
      );
      setHistory(updatedHistory);
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const deleteHistoryItem = async (index: number) => {
    try {
      const updatedHistory = history.filter((_, i) => i !== index);
      await AsyncStorage.setItem(
        "cropPredictionHistory",
        JSON.stringify(updatedHistory),
      );
      setHistory(updatedHistory);
    } catch (error) {
      console.error("Error deleting history item:", error);
    }
  };

  const handleInputChange = (field: keyof CropData, value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    setFormData((prev) => ({ ...prev, [field]: numValue }));
  };

  const validateForm = (): boolean => {
    if (formData.ph === null) {
      Alert.alert(
        "pH Required",
        "Please enter the pH value. This is a mandatory field for accurate crop prediction.",
      );
      return false;
    }

    if (formData.ph < 0 || formData.ph > 14) {
      Alert.alert("Invalid pH", "pH must be between 0 and 14");
      return false;
    }

    const missingParams = [];
    if (formData.N === null) missingParams.push("Nitrogen (N)");
    if (formData.P === null) missingParams.push("Phosphorus (P)");
    if (formData.K === null) missingParams.push("Potassium (K)");

    if (missingParams.length > 0) {
      Alert.alert(
        "Using Default Values",
        `${missingParams.join(", ")} not provided. Using average values for prediction.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => proceedWithSubmit() },
        ],
      );
      return false;
    }

    return true;
  };

  const getCropInfo = (cropName: string) => {
    const normalizedName = cropName.toLowerCase().trim();
    const info = CROP_INFO[normalizedName];

    if (!info) {
      console.warn(`No info found for crop: ${cropName}`);
      return {
        description: `${cropName} is suitable for your soil and climate conditions. Consult local agricultural experts for detailed cultivation practices.`,
        imageUrl:
          "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop",
        season: "Varies",
        water: "Varies",
        soil: "Varies",
      };
    }

    return info;
  };

  const proceedWithSubmit = () => {
    performAPICall();
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      if (formData.ph !== null && formData.ph >= 0 && formData.ph <= 14) {
        await performAPICall();
      }
      return;
    }

    await performAPICall();
  };

  const performAPICall = async () => {
    console.log("========== STARTING API CALL ==========");
    setLoading(true);
    setSubmitted(true);

    try {
      const apiData = {
        N: formData.N ?? MEAN_VALUES.N,
        P: formData.P ?? MEAN_VALUES.P,
        K: formData.K ?? MEAN_VALUES.K,
        ph: formData.ph!,
        temperature: formData.temperature,
        humidity: formData.humidity,
        rainfall: formData.rainfall,
      };

      const API_URL = `http://localhost:8000/predict?ph=${apiData.ph}&n=${apiData.N}&p=${apiData.P}&k=${apiData.K}&temp=${apiData.temperature}&humidity=${apiData.humidity}&rainfall=${apiData.rainfall}`;

      const response = await fetch(API_URL);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error("API Error: " + response.status + " - " + errorText);
      }

      const result = await response.json();

      if (!result.top_predictions || !Array.isArray(result.top_predictions)) {
        throw new Error("API response missing top_predictions field");
      }

      // Process top 3 predictions
      const predictions: CropPrediction[] = result.top_predictions.map(
        (pred: TopPrediction) => {
          const cropInfo = getCropInfo(pred.crop);
          return {
            crop: pred.crop,
            description: cropInfo.description,
            imageUrl: cropInfo.imageUrl,
            growing_season: cropInfo.season,
            water_requirements: cropInfo.water,
            soil_type: cropInfo.soil,
            rank: pred.rank,
          };
        },
      );

      const newPredictionResult: PredictionResult = {
        predictions,
        timestamp: Date.now(),
        inputData: { ...formData, ...apiData },
      };
      setPredictionResult(newPredictionResult);
      await saveToHistory(newPredictionResult);
    } catch (error) {
      console.error("API Error Details:", error);

      Alert.alert(
        "Prediction Failed",
        "Error: " +
          (error instanceof Error ? error.message : "Unknown error") +
          ". Please check your API server.",
        [{ text: "OK" }],
      );

      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      N: null,
      P: null,
      K: null,
      ph: null,
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      rainfall: weatherData.rainfall,
    });
    setPredictionResult(null);
    setSubmitted(false);
  };

  const loadHistoryItem = (item: PredictionResult) => {
    if (item.inputData) {
      setFormData(item.inputData);
    }
    setPredictionResult(item);
    setSubmitted(true);
    setShowHistory(false);
  };

  const renderRightActions = (index: number) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            "Delete Prediction",
            "Are you sure you want to delete this prediction?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => deleteHistoryItem(index),
              },
            ],
          );
        }}
      >
        <Trash2 color="white" size={24} />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "#FFD700"; // Gold
      case 2:
        return "#C0C0C0"; // Silver
      case 3:
        return "#CD7F32"; // Bronze
      default:
        return "#4CAF50";
    }
  };

  const getRankLabel = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇 Best Match";
      case 2:
        return "🥈 2nd Best";
      case 3:
        return "🥉 3rd Best";
      default:
        return `#${rank}`;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft color="#4CAF50" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Recommendation</Text>
          <TouchableOpacity
            onPress={() => setShowHistory(true)}
            style={styles.historyButton}
          >
            <History color="#4CAF50" size={24} />
          </TouchableOpacity>
        </View>

        {/* Weather Summary */}
        <View style={styles.weatherSummary}>
          <Text style={styles.weatherTitle}>
            Current Weather - {weatherData.district}
          </Text>
          <View style={styles.weatherRow}>
            <View style={styles.weatherItem}>
              <Text style={styles.weatherValue}>{formData.temperature}°C</Text>
              <Text style={styles.weatherLabel}>Temp</Text>
            </View>
            <View style={styles.weatherItem}>
              <Text style={styles.weatherValue}>{formData.humidity}%</Text>
              <Text style={styles.weatherLabel}>Humidity</Text>
            </View>
            <View style={styles.weatherItem}>
              <Text style={styles.weatherValue}>{formData.rainfall}mm</Text>
              <Text style={styles.weatherLabel}>Rainfall</Text>
            </View>
          </View>
        </View>

        {/* Input Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Enter Soil Parameters</Text>

          {[
            {
              key: "N",
              label: "Nitrogen (N) kg/ha (Optional)",
              placeholder: "e.g., 90.5",
            },
            {
              key: "P",
              label: "Phosphorus (P) kg/ha (Optional)",
              placeholder: "e.g., 42.3",
            },
            {
              key: "K",
              label: "Potassium (K) kg/ha (Optional)",
              placeholder: "e.g., 43.7",
            },
            {
              key: "ph",
              label: "pH Level (0-14) *Required",
              placeholder: "e.g., 6.5",
            },
          ].map((param) => (
            <View key={param.key} style={styles.inputGroup}>
              <Text
                style={[
                  styles.inputLabel,
                  param.key === "ph" && styles.requiredLabel,
                ]}
              >
                {param.label}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  param.key === "ph" && styles.requiredInput,
                ]}
                keyboardType="numeric"
                value={formData[param.key as keyof CropData]?.toString() || ""}
                onChangeText={(value) =>
                  handleInputChange(param.key as keyof CropData, value)
                }
                placeholder={param.placeholder}
                editable={!submitted}
                maxLength={10}
              />
            </View>
          ))}

          <Text style={styles.infoText}>
            * pH is required. NPK values are optional - average values will be
            used if not provided.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={loading || submitted}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {submitted ? "Submitted" : "Get Recommendation"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Results Section - Show all 3 predictions */}
        {predictionResult && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>🌾 Top 3 Recommended Crops</Text>

            {predictionResult.predictions.map((prediction, index) => (
              <View key={index} style={styles.cropCard}>
                <View
                  style={[
                    styles.rankBadge,
                    { backgroundColor: getRankBadgeColor(prediction.rank) },
                  ]}
                >
                  <Text style={styles.rankText}>
                    {getRankLabel(prediction.rank)}
                  </Text>
                </View>

                <Image
                  source={{ uri: prediction.imageUrl }}
                  style={styles.cropImage}
                />

                <Text style={styles.cropName}>{prediction.crop}</Text>

                <Text style={styles.description}>{prediction.description}</Text>

                <View style={styles.cropDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Growing Season:</Text>
                    <Text style={styles.detailValue}>
                      {prediction.growing_season}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Water Needs:</Text>
                    <Text style={styles.detailValue}>
                      {prediction.water_requirements}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Soil Type:</Text>
                    <Text style={styles.detailValue}>
                      {prediction.soil_type}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Prediction History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.historyList}>
              {history.length === 0 ? (
                <Text style={styles.emptyHistory}>No predictions yet</Text>
              ) : (
                history.map((item, index) => (
                  <Swipeable
                    key={index}
                    renderRightActions={() => renderRightActions(index)}
                  >
                    <TouchableOpacity
                      style={styles.historyItem}
                      onPress={() => loadHistoryItem(item)}
                    >
                      <View style={styles.historyItemContent}>
                        <Text style={styles.historyItemCrop}>
                          {item.predictions?.length > 0
                            ? item.predictions[0].crop
                            : "Unknown"}
                        </Text>
                        <Text style={styles.historyItemDate}>
                          {new Date(item.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginLeft: 10,
  },
  historyButton: {
    padding: 5,
  },
  weatherSummary: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weatherTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 15,
  },
  weatherRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  weatherItem: {
    alignItems: "center",
  },
  weatherValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  weatherLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
  },
  formContainer: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
    fontWeight: "500",
  },
  requiredLabel: {
    color: "#D32F2F",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  requiredInput: {
    borderColor: "#FF9800",
    borderWidth: 1.5,
  },
  infoText: {
    fontSize: 12,
    color: "#757575",
    fontStyle: "italic",
    marginBottom: 10,
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: "#4CAF50",
    marginLeft: 10,
  },
  resetButton: {
    backgroundColor: "#757575",
    marginRight: 10,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  resetButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  resultContainer: {
    padding: 16,
    paddingBottom: 50,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  cropCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rankBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  rankText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  cropImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#F0F0F0",
  },
  cropName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textTransform: "capitalize",
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: "#555",
    lineHeight: 22,
    marginBottom: 20,
  },
  cropDetails: {
    backgroundColor: "#F9F9F9",
    padding: 15,
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    fontSize: 28,
    color: "#999",
    fontWeight: "300",
  },
  historyList: {
    padding: 16,
  },
  emptyHistory: {
    textAlign: "center",
    color: "#999",
    fontSize: 16,
    marginTop: 50,
  },
  historyItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemCrop: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textTransform: "capitalize",
  },
  historyItemDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: "#F44336",
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    marginBottom: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  deleteButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 5,
  },
});

export default CropPredictionScreen;
