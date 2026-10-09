<?php

namespace App\Models;

use Database\Factories\InquiryMessageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['sender_id', 'client_id', 'body'])]
class InquiryMessage extends Model
{
    /** @use HasFactory<InquiryMessageFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
