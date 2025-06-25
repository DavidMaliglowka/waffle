import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Text,
  ActivityIndicator,
} from 'react-native';
import { cn } from '@/lib/utils';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  className,
  ...props
}) => {
  const baseClasses = 'flex-row items-center justify-center rounded-waffle';
  
  const variantClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary', 
    outline: 'border-2 border-primary bg-transparent',
    ghost: 'bg-transparent',
  };

  const sizeClasses = {
    small: 'px-3 py-2',
    medium: 'px-4 py-3', 
    large: 'px-6 py-4',
  };

  const textVariantClasses = {
    primary: 'text-white font-body-bold',
    secondary: 'text-white font-body-bold',
    outline: 'text-primary font-body-bold',
    ghost: 'text-primary font-body-medium',
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  const disabledClasses = disabled ? 'opacity-50' : '';
  const fullWidthClasses = fullWidth ? 'w-full' : '';

  const buttonClasses = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabledClasses,
    fullWidthClasses,
    className
  );

  const textClasses = cn(
    textVariantClasses[variant],
    textSizeClasses[size]
  );

  return (
    <TouchableOpacity
      className={buttonClasses}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' || variant === 'secondary' ? 'white' : '#FDB833'} 
        />
      ) : (
        <Text className={textClasses}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}; 