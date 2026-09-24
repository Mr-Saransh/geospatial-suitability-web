"""Model listing and detail endpoints."""
from fastapi import APIRouter, HTTPException
from app.services.weights import MODELS_REGISTRY
from app.schemas import ModelSummary, ModelDetail, CriterionWeight, ClassificationRange

router = APIRouter(prefix="/api/v1", tags=["models"])


@router.get("/models", response_model=list[ModelSummary])
def list_models():
    """List all available susceptibility models."""
    return [
        ModelSummary(
            model_id=m.model_id,
            name=m.name,
            criterion_count=len(m.criteria),
            consistency_ratio=m.consistency_ratio,
        )
        for m in MODELS_REGISTRY.values()
    ]


@router.get("/models/{model_id}", response_model=ModelDetail)
def get_model(model_id: str):
    """Get detailed information about a specific model."""
    model = MODELS_REGISTRY.get(model_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    return ModelDetail(
        model_id=model.model_id,
        name=model.name,
        version=model.version,
        criterion_count=len(model.criteria),
        criteria=list(model.criteria),
        weights=[
            CriterionWeight(criterion_id=c, weight=model.weights[c])
            for c in model.criteria
        ],
        consistency_ratio=model.consistency_ratio,
        consistency_index=model.consistency_index,
        lambda_max=model.lambda_max,
        random_index=model.random_index,
        classification=[
            ClassificationRange(
                class_value=k,
                label=model.classification_labels[k],
                range_min=v[0],
                range_max=v[1],
            )
            for k, v in model.classification_ranges.items()
        ],
        metadata=model.metadata,
    )
