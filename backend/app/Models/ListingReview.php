<?php

namespace App\Models;

use Database\Factories\ListingReviewFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['property_id', 'administrator_id', 'revision', 'decision', 'reason'])]
class ListingReview extends Model
{
    /** @use HasFactory<ListingReviewFactory> */
    use HasFactory;

    public const UPDATED_AT = null;
}
