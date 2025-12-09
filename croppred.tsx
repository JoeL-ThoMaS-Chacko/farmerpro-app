import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, History, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

interface CropData {
  N: number | null;
  P: number | null;
  K: number | null;
  ph: number | null;
  temperature: number;
  humidity: number;
  rainfall: number;
}

interface CropPrediction {
  crop: string;
  confidence: number;
  description: string;
  imageUrl: string;
  growing_season: string;
  water_requirements: string;
  soil_type: string;
  timestamp: number;
  inputData?: CropData;
}

// Crop information database
const CROP_INFO: { [key: string]: { description: string; imageUrl: string; season: string; water: string; soil: string } } = {
  'rice': {
    description: 'Rice thrives in warm, humid conditions with clayey soil that retains water well. Ideal for Kerala climate with monsoon irrigation.',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop',
    season: 'June - October (Kharif)',
    water: 'High (1200-2500 mm)',
    soil: 'Clayey loam'
  },
  'coconut': {
    description: 'Coconut palms grow excellently in coastal regions with high humidity, well-drained sandy loam soil, and consistent rainfall throughout the year.',
    imageUrl: 'https://images.unsplash.com/photo-1598534299099-e5f44d11d125?w=400&h=300&fit=crop',
    season: 'Year-round',
    water: 'Moderate (1000-1500 mm)',
    soil: 'Sandy loam'
  },
  'banana': {
    description: 'Bananas require warm temperatures, high humidity, and rich, well-drained soil with plenty of organic matter for optimal growth.',
    imageUrl: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&h=300&fit=crop',
    season: 'Year-round',
    water: 'High (1200-2200 mm)',
    soil: 'Rich loamy soil'
  },
  'wheat': {
    description: 'Wheat grows best in cool, dry climates with well-drained fertile soil. It requires moderate rainfall and cool temperatures during growing season.',
    imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&h=300&fit=crop',
    season: 'October - March (Rabi)',
    water: 'Moderate (450-650 mm)',
    soil: 'Well-drained loam'
  },
  'maize': {
    description: 'Maize requires warm weather, fertile well-drained soil rich in organic matter, and adequate moisture during the growing period.',
    imageUrl: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&h=300&fit=crop',
    season: 'June - September (Kharif)',
    water: 'Moderate (500-800 mm)',
    soil: 'Sandy loam to clay loam'
  },
  'sugarcane': {
    description: 'Sugarcane thrives in tropical climate with high temperature, abundant sunshine, and plenty of water. Requires well-drained fertile soil.',
    imageUrl: 'https://images.unsplash.com/photo-1591020100-3b7566f8c1e6?w=400&h=300&fit=crop',
    season: 'Year-round',
    water: 'High (1500-2500 mm)',
    soil: 'Deep loamy soil'
  },
  'cotton': {
    description: 'Cotton requires warm climate, moderate rainfall, and black cotton soil. Needs at least 200 frost-free days for optimal growth.',
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&h=300&fit=crop',
    season: 'April - October (Kharif)',
    water: 'Moderate (600-1200 mm)',
    soil: 'Black cotton soil'
  },
  'groundnut': {
    description: 'Groundnut grows well in warm climate with light sandy loam soil. It requires moderate rainfall and good drainage.',
    imageUrl: 'https://images.unsplash.com/photo-1608797178974-15b35a64ede9?w=400&h=300&fit=crop',
    season: 'June - September',
    water: 'Moderate (500-700 mm)',
    soil: 'Sandy loam'
  },
  'default': {
    description: 'This crop is suitable for your soil and climate conditions. Consult local agricultural experts for detailed cultivation practices.',
    imageUrl: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop',
    season: 'Varies',
    water: 'Varies',
    soil: 'Varies'
  }
};

const CropPredictionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  const weatherData = route.params?.weather || {
    temperature: 28,
    humidity: 75,
    rainfall: 2500
  };

  const [formData, setFormData] = useState<CropData>({
    N: null,
    P: null,
    K: null,
    ph: null,
    temperature: weatherData.temperature,
    humidity: weatherData.humidity,
    rainfall: weatherData.rainfall
  });

  const [prediction, setPrediction] = useState<CropPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [history, setHistory] = useState<CropPrediction[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('cropPredictionHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const saveToHistory = async (newPrediction: CropPrediction) => {
    try {
      const updatedHistory = [newPrediction, ...history];
      await AsyncStorage.setItem('cropPredictionHistory', JSON.stringify(updatedHistory));
      setHistory(updatedHistory);
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  };

  const deleteHistoryItem = async (index: number) => {
    try {
      const updatedHistory = history.filter((_, i) => i !== index);
      await AsyncStorage.setItem('cropPredictionHistory', JSON.stringify(updatedHistory));
      setHistory(updatedHistory);
    } catch (error) {
      console.error('Error deleting history item:', error);
    }
  };

  const handleInputChange = (field: keyof CropData, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const validateForm = (): boolean => {
    if (formData.N === null || formData.P === null || formData.K === null || formData.ph === null) {
      Alert.alert('Error', 'Please fill all required fields (N, P, K, pH)');
      return false;
    }
    
    if (formData.ph !== null && (formData.ph < 0 || formData.ph > 14)) {
      Alert.alert('Error', 'pH must be between 0 and 14');
      return false;
    }
    
    if (formData.N !== null && formData.N < 0) {
      Alert.alert('Error', 'Nitrogen (N) cannot be negative');
      return false;
    }
    
    return true;
  };

  const getCropInfo = (cropName: string) => {
    const normalizedName = cropName.toLowerCase().trim();
    return CROP_INFO[normalizedName] || CROP_INFO['default'];
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setSubmitted(true);
    setImageError(false);

    try {
      // Replace with your FastAPI endpoint
      const API_URL = 'http://YOUR_FASTAPI_SERVER:8000/predict';
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          N: formData.N,
          P: formData.P,
          K: formData.K,
          ph: formData.ph,
          temperature: formData.temperature,
          humidity: formData.humidity,
          rainfall: formData.rainfall
        })
      });

      const result = await response.json();
      
      // Expected API response format: { crop: "rice", confidence: 0.92 }
      const cropInfo = getCropInfo(result.crop);
      
      const newPrediction: CropPrediction = {
        crop: result.crop,
        confidence: result.confidence || 0.85,
        description: cropInfo.description,
        imageUrl: cropInfo.imageUrl,
        growing_season: cropInfo.season,
        water_requirements: cropInfo.water,
        soil_type: cropInfo.soil,
        timestamp: Date.now(),
        inputData: { ...formData }
      };

      setPrediction(newPrediction);
      await saveToHistory(newPrediction);

    } catch (error) {
      console.error('API Error:', error);
      
      // Fallback to mock prediction if API fails
      Alert.alert(
        'API Connection Failed',
        'Using demo prediction. Please ensure your FastAPI server is running.',
        [{ text: 'OK' }]
      );
      
      // Mock prediction logic
      let selectedCrop = 'rice';
      if (formData.ph && formData.ph > 7.5) {
        selectedCrop = 'banana';
      } else if (formData.temperature < 25) {
        selectedCrop = 'wheat';
      } else if (formData.rainfall > 2000) {
        selectedCrop = 'rice';
      } else {
        selectedCrop = 'coconut';
      }
      
      const cropInfo = getCropInfo(selectedCrop);
      const mockPrediction: CropPrediction = {
        crop: selectedCrop,
        confidence: 0.85,
        description: cropInfo.description,
        imageUrl: cropInfo.imageUrl,
        growing_season: cropInfo.season,
        water_requirements: cropInfo.water,
        soil_type: cropInfo.soil,
        timestamp: Date.now(),
        inputData: { ...formData }
      };
      
      setPrediction(mockPrediction);
      await saveToHistory(mockPrediction);
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
      rainfall: weatherData.rainfall
    });
    setPrediction(null);
    setSubmitted(false);
  };

  const loadHistoryItem = (item: CropPrediction) => {
    if (item.inputData) {
      setFormData(item.inputData);
    }
    setPrediction(item);
    setSubmitted(true);
    setShowHistory(false);
  };

  const renderRightActions = (index: number) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            'Delete Prediction',
            'Are you sure you want to delete this prediction?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteHistoryItem(index) }
            ]
          );
        }}
      >
        <Trash2 color="white" size={24} />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
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
            <Text style={styles.weatherTitle}>Current Weather</Text>
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
              { key: 'N', label: 'Nitrogen (N) kg/ha', placeholder: 'e.g., 90' },
              { key: 'P', label: 'Phosphorus (P) kg/ha', placeholder: 'e.g., 42' },
              { key: 'K', label: 'Potassium (K) kg/ha', placeholder: 'e.g., 43' },
              { key: 'ph', label: 'pH Level (0-14)', placeholder: 'e.g., 6.5' }
            ].map((param) => (
              <View key={param.key} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{param.label}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={formData[param.key as keyof CropData]?.toString() || ''}
                  onChangeText={(value) => handleInputChange(param.key as keyof CropData, value)}
                  placeholder={param.placeholder}
                  editable={!submitted}
                  maxLength={5}
                />
              </View>
            ))}

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
                    {submitted ? 'Submitted' : 'Get Recommendation'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Results Section */}
          {prediction && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>🌾 Recommended Crop</Text>
              
              <View style={styles.cropCard}>
                <Image 
                  source={{ uri: prediction.imageUrl }}
                  style={styles.cropImage}
                  onError={() => setImageError(true)}
                />
                
                <View style={styles.cropHeader}>
                  <Text style={styles.cropName}>{prediction.crop}</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {(prediction.confidence * 100).toFixed(0)}% Match
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.description}>{prediction.description}</Text>
                
                <View style={styles.cropDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Growing Season:</Text>
                    <Text style={styles.detailValue}>{prediction.growing_season}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Water Needs:</Text>
                    <Text style={styles.detailValue}>{prediction.water_requirements}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Soil Type:</Text>
                    <Text style={styles.detailValue}>{prediction.soil_type}</Text>
                  </View>
                </View>
              </View>
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
                          <Text style={styles.historyItemCrop}>{item.crop}</Text>
                          <Text style={styles.historyItemDate}>
                            {new Date(item.timestamp).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={styles.historyItemConfidence}>
                          {(item.confidence * 100).toFixed(0)}%
                        </Text>
                      </TouchableOpacity>
                    </Swipeable>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginLeft: 10,
  },
  historyButton: {
    padding: 5,
  },
  weatherSummary: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weatherTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 15,
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weatherItem: {
    alignItems: 'center',
  },
  weatherValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  weatherLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  formContainer: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 10,
  },
  resetButton: {
    backgroundColor: '#757575',
    marginRight: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    padding: 16,
    paddingBottom: 50,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  cropCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cropImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#F0F0F0',
  },
  cropHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cropName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  confidenceBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confidenceText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#555',
    lineHeight: 22,
    marginBottom: 20,
  },
  cropDetails: {
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 28,
    color: '#999',
    fontWeight: '300',
  },
  historyList: {
    padding: 16,
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 50,
  },
  historyItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemCrop: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  historyItemDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  historyItemConfidence: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    marginBottom: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
});

export default CropPredictionScreen;