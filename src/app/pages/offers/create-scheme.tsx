import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  BarChart3,
  DollarSign,
  Gift,
  Package,
  FileText,
  AlertCircle,
  Rocket,
  Award,
  ShoppingBag,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface SchemeType {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const schemeTypes: SchemeType[] = [
  {
    id: "qps",
    name: "QPS",
    icon: <BarChart3 className="h-8 w-8" />,
    description: "Quantity-based price slabs with tiered discounts",
    color: "blue",
  },
  {
    id: "value-slab",
    name: "Value Slab",
    icon: <DollarSign className="h-8 w-8" />,
    description: "Order value-based discount tiers",
    color: "amber",
  },
  {
    id: "bogo",
    name: "BOGO",
    icon: <Gift className="h-8 w-8" />,
    description: "Buy X quantity, get Y free units",
    color: "red",
  },
  {
    id: "case-bonus",
    name: "Case Bonus",
    icon: <Package className="h-8 w-8" />,
    description: "Extra cases free on bulk purchase",
    color: "orange",
  },
  {
    id: "off-invoice",
    name: "Off-Invoice",
    icon: <FileText className="h-8 w-8" />,
    description: "Flat discount applied on invoice total",
    color: "purple",
  },
  {
    id: "display-allowance",
    name: "Display Allowance",
    icon: <AlertCircle className="h-8 w-8" />,
    description: "Incentive for in-store product display",
    color: "cyan",
  },
  {
    id: "launch-incentive",
    name: "Launch Incentive",
    icon: <Rocket className="h-8 w-8" />,
    description: "Special pricing for new product launches",
    color: "pink",
  },
  {
    id: "loyalty-rebate",
    name: "Loyalty Rebate",
    icon: <Award className="h-8 w-8" />,
    description: "Cashback rebate for repeat purchases",
    color: "yellow",
  },
  {
    id: "combo-bundle",
    name: "Combo Bundle",
    icon: <ShoppingBag className="h-8 w-8" />,
    description: "Bundled products at discounted rate",
    color: "orange",
  },
  {
    id: "early-payment",
    name: "Early Payment",
    icon: <Clock className="h-8 w-8" />,
    description: "Discount for early invoice settlement",
    color: "red",
  },
];

const getColorClasses = (color: string, isSelected: boolean) => {
  const colors = {
    blue: isSelected
      ? "border-blue-500 bg-blue-50"
      : "border-gray-200 hover:border-blue-300",
    amber: isSelected
      ? "border-amber-500 bg-amber-50"
      : "border-gray-200 hover:border-amber-300",
    red: isSelected
      ? "border-red-500 bg-red-50"
      : "border-gray-200 hover:border-red-300",
    orange: isSelected
      ? "border-orange-500 bg-orange-50"
      : "border-gray-200 hover:border-orange-300",
    purple: isSelected
      ? "border-purple-500 bg-purple-50"
      : "border-gray-200 hover:border-purple-300",
    cyan: isSelected
      ? "border-cyan-500 bg-cyan-50"
      : "border-gray-200 hover:border-cyan-300",
    pink: isSelected
      ? "border-pink-500 bg-pink-50"
      : "border-gray-200 hover:border-pink-300",
    yellow: isSelected
      ? "border-yellow-500 bg-yellow-50"
      : "border-gray-200 hover:border-yellow-300",
  };
  return colors[color as keyof typeof colors] || colors.blue;
};

const getIconColorClass = (color: string) => {
  const colors = {
    blue: "text-blue-600 bg-blue-100",
    amber: "text-amber-600 bg-amber-100",
    red: "text-red-600 bg-red-100",
    orange: "text-orange-600 bg-orange-100",
    purple: "text-purple-600 bg-purple-100",
    cyan: "text-cyan-600 bg-cyan-100",
    pink: "text-pink-600 bg-pink-100",
    yellow: "text-yellow-600 bg-yellow-100",
  };
  return colors[color as keyof typeof colors] || colors.blue;
};

export function CreateScheme() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);

  const handleSchemeSelect = (schemeId: string) => {
    setSelectedScheme(schemeId);
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedScheme) {
      toast.error("Please select a scheme type");
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate("/offers");
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Create New Scheme</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => navigate("/offers")}>
              Schemes
            </span>{" "}
            / Create Scheme
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentStep > 1
                    ? "bg-green-500 text-white"
                    : currentStep === 1
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > 1 ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <span className="font-semibold">1</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 mt-2">
                Select Type
              </p>
            </div>

            {/* Line */}
            <div
              className={`w-32 h-0.5 mx-4 ${
                currentStep > 1 ? "bg-green-500" : "bg-gray-300"
              }`}
            />

            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentStep > 2
                    ? "bg-green-500 text-white"
                    : currentStep === 2
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                <span className="font-semibold">2</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mt-2">
                Configure Details
              </p>
            </div>

            {/* Line */}
            <div
              className={`w-32 h-0.5 mx-4 ${
                currentStep > 2 ? "bg-green-500" : "bg-gray-300"
              }`}
            />

            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentStep === 3
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                <span className="font-semibold">3</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mt-2">
                Review & Publish
              </p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <div>
            {/* Step Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Select Scheme Type
              </h2>
              <div className="text-sm">
                <span className="text-blue-600 font-medium">Step 1</span>
                <span className="text-gray-600"> - Completed</span>
              </div>
            </div>

            {/* Scheme Types Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
              {schemeTypes.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => handleSchemeSelect(scheme.id)}
                  className={`p-6 rounded-xl border-2 transition-all text-left ${getColorClasses(
                    scheme.color,
                    selectedScheme === scheme.id
                  )}`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div
                      className={`w-16 h-16 rounded-xl flex items-center justify-center ${getIconColorClass(
                        scheme.color
                      )}`}
                    >
                      {scheme.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {scheme.name}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {scheme.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Configure Details
              </h2>
              <p className="text-gray-600 mt-1">
                Set up the rules and parameters for your scheme
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Configuration Form
                  </h3>
                  <p className="text-gray-600">
                    This step will contain the detailed configuration form based
                    on the selected scheme type.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Review & Publish
              </h2>
              <p className="text-gray-600 mt-1">
                Review your scheme details before publishing
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <CheckCircle2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Review Summary
                  </h3>
                  <p className="text-gray-600">
                    This step will show a summary of all configured details for
                    final review.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={handleBack}>
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>
          <Button onClick={handleNext}>
            {currentStep === 3 ? "Publish Scheme" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
