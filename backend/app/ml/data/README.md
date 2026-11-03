# PETRAILS Actuarial Underwriting Dataset (v1)

## File: `pet_underwriting_actuarial_v1.csv`

### 1. Dataset Overview & Provenance
This dataset contains **1,600 simulated pet insurance actuarial underwriting records** calibrated to standard veterinary epidemiological literature and actuarial hazard curves.

> **Provenance Declaration:**
> This dataset is **synthetically generated** for development, demonstration, and validation purposes. It does not contain proprietary historical claims data from any commercial insurer or identifiable individual pet/owner information.

---

### 2. Feature Schema

| Column Name | Type | Description | Range / Values |
| :--- | :--- | :--- | :--- |
| `age` | Float | Animal age in years (Gamma distributed, $\alpha=2.5, \beta=1.8$) | $0.5$ to $14.0$ |
| `is_canine` | Integer | Binary species flag ($1$ = Canine/Dog, $0$ = Feline/Cat) | $\{0, 1\}$ (72% dog, 28% cat) |
| `is_high_risk_breed` | Integer | Breed susceptibility flag (e.g. Bulldog, Golden Retriever) | $\{0, 1\}$ |
| `weight_kg` | Float | Measured animal body mass in kilograms | $1.5$ to $65.0$ kg |
| `medical_history_count` | Integer | Declared prior clinical incidents / pre-existing conditions | $0$ to $8$ (Poisson distributed) |
| `vaccination_compliant` | Integer | Core immunization status compliance ($1$ = Up to date) | $\{0, 1\}$ |
| `baseline_rule_score_reference`| Float | Guidewire deterministic rule baseline (for reference) | $20.0$ to $95.0$ |
| `risk_score` | Float | **Target Variable:** Expected actuarial annualized loss index | $12.0$ to $92.0$ |

---

### 3. Target Variable Definition
The target variable `risk_score` reflects prospective loss severity and claim frequency risk. It is generated using the following calibrated actuarial loss formula:

$$\text{risk\_score} = 0.55 \times \text{rule\_score} + 2.2 \times \text{age} + 3.8 \times \text{med\_count} + 6.0 \times \text{is\_high\_risk} - 5.0 \times \text{vacc\_compliant} + \text{interaction} + \epsilon$$

Where:
- $\text{interaction} = 8.0$ if $\text{age} \ge 6.0$ and $\text{is\_high\_risk} = 1$ (senior canine brachycephalic/orthopedic hazard).
- $\epsilon \sim \mathcal{N}(0, 2.5^2)$ represents residual idiosyncratic market loss variance.

---

### 4. Machine Learning Model Independence
To avoid data leakage, `baseline_rule_score_reference` is **excluded** from the machine learning model's input feature set. The Random Forest Regressor is trained strictly on the 6 independent clinical features:
`['age', 'is_canine', 'is_high_risk_breed', 'weight_kg', 'medical_history_count', 'vaccination_compliant']`.

### 5. Reproducibility Procedure
To regenerate this dataset and retrain the models:
```bash
cd backend
python -m app.ml.train_models
```
All random number generators are seeded with `seed=42`.
