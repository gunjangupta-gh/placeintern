import React, { useState, useEffect } from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { getImageUrl, getPresignedUrl } from '../../utils/imageUtils';

/**
 * ProfileAvatar component that handles MinIO presigned URLs
 * Automatically fetches presigned URL for profile images stored in MinIO
 */
const ProfileAvatar = ({
  profileImage,
  icon = <UserOutlined />,
  size,
  className,
  style,
  ...props
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchPresignedUrl = async () => {
      if (!profileImage) {
        setImageUrl(null);
        return;
      }

      // If it's already a full HTTP URL (like Cloudinary), use it directly
      if (profileImage.startsWith('http')) {
        // Still need presigned URL for MinIO URLs
        if (profileImage.includes('minio') || profileImage.includes('127.0.0.1:9000') || profileImage.includes('cms-uploads')) {
          setLoading(true);
          try {
            const presignedUrl = await getPresignedUrl(profileImage);
            if (isMounted) {
              setImageUrl(presignedUrl);
            }
          } catch (error) {
            console.error('Failed to get presigned URL:', error);
            if (isMounted) {
              setImageUrl(profileImage);
            }
          } finally {
            if (isMounted) {
              setLoading(false);
            }
          }
        } else {
          // Non-MinIO URL (like Cloudinary), use directly
          setImageUrl(profileImage);
        }
        return;
      }

      // For relative paths, get full URL first then presigned URL
      setLoading(true);
      try {
        const fullUrl = getImageUrl(profileImage);
        const presignedUrl = await getPresignedUrl(fullUrl);
        if (isMounted) {
          setImageUrl(presignedUrl);
        }
      } catch (error) {
        console.error('Failed to get presigned URL:', error);
        if (isMounted) {
          setImageUrl(getImageUrl(profileImage));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPresignedUrl();

    return () => {
      isMounted = false;
    };
  }, [profileImage]);

  return (
    <Avatar
      icon={icon}
      src={imageUrl}
      size={size}
      className={className}
      style={style}
      {...props}
    />
  );
};

export default ProfileAvatar;
